// routes/auth.js — user registration and login.
// POST /register creates a user (with an empty balances row and, when a
// referral code was used, a pending referrals row). POST /login returns a
// user JWT (7 days) and enforces 2FA when the admin has enabled it.
// Rules: one account per email (case-insensitive), per username and per
// phone number (normalized, so +8801712..., 01712... count as one; phone
// is optional). Passwords are bcrypt-hashed (12 rounds), minimum 8 chars.
// A one-time admin OTP can be used as the current password (24 hours,
// one use) and then forces a password change.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const { getOrCreateBalance } = require('../services/moneyHelpers');
const emailSvc = require('../services/emailService');
// Signs a user JWT (type 'user'). All user tokens expire in 7 days.
function mkT(p){return jwt.sign(p,process.env.JWT_SECRET,{expiresIn:'7d'});}

// Normalize a phone number to digits-only with country code, so the same number
// in different formats (+8801712..., 01712..., 01712-345678) matches as one.
// A leading trunk 0 is dropped when a country code is present; an explicit
// leading + is trusted as-is.
function normalizePhone(countryCode, phone){
  if(!phone) return null;
  const raw=String(phone).trim();
  const ccDigits=(countryCode||'').replace(/\D/g,'');
  let digits=raw.replace(/\D/g,'');
  if(!digits) return null;
  if(raw.startsWith('+')) return digits;
  if(ccDigits && digits.startsWith(ccDigits)) return digits;
  if(ccDigits && digits.startsWith('0')) digits=digits.slice(1);
  return ccDigits ? ccDigits+digits : digits;
}

// POST /register — creates a user. Body: full_name, username, email,
// phone, password are all required; referral_code is optional.
// Side effects:
// inserts the user row, creates the empty balances row, records a pending
// referral link when a code was given, and notifies the admin.
router.post('/register', async (req,res)=>{
  try{
    const {full_name,username,email,phone,country_code,password,referral_code}=req.body;
    if(!full_name||!username||!email||!phone||!password) return res.status(400).json({error:'Required fields missing'});
    if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    const db=getDb();
    // One account per email (case-insensitive: Test@x.com == test@x.com)
    const emailNorm=String(email).trim().toLowerCase();
    if(db.prepare('SELECT id FROM users WHERE LOWER(email)=?').get(emailNorm)) return res.status(400).json({error:'Email already registered'});
    if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken'});
    // One account per phone number (normalized, so +8801712..., 01712... match).
    // Phone is optional — only checked when provided.
    const phoneNorm=normalizePhone(country_code,phone);
    if(phoneNorm){
      const dup=db.prepare('SELECT phone,country_code FROM users WHERE phone IS NOT NULL AND phone<>?').all('')
        .some(u=>normalizePhone(u.country_code,u.phone)===phoneNorm);
      if(dup) return res.status(400).json({error:'Phone number already registered'});
    }
    const hash=await bcrypt.hash(password,12);
    const vt=uuidv4(), ve=Math.floor(Date.now()/1000)+86400;
    let refById=null;
    if(referral_code){const r=db.prepare('SELECT id FROM users WHERE referral_code=? OR username=?').get(referral_code,referral_code);if(r)refById=r.id;}
    const rc=Math.random().toString(36).substring(2,10).toUpperCase();
    const uid=db.prepare('INSERT INTO users (full_name,username,email,phone,country_code,password_hash,referral_code,referred_by_user_id,email_verify_token,email_verify_expires) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(full_name,username,emailNorm,phone||null,country_code||'+44',hash,rc,refById,vt,ve).lastInsertRowid;
    getOrCreateBalance(uid);
    if(refById) db.prepare('INSERT OR IGNORE INTO referrals (referrer_user_id,referred_user_id) VALUES (?,?)').run(refById,uid);
    const su=process.env.SITE_URL||'http://localhost:3000';
    if(emailSvc.isSmtpConfigured()) await emailSvc.sendVerifyEmail(emailNorm,vt,su);
    else console.log(`[DEV] Email verify: ${su}/verify-email?token=${vt}`);
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('new_user',`New User Joined — ${full_name} (@${username})`,`New registration · ${emailNorm}`,uid,'user','users');
    res.json({success:true,message:'Registration successful.'});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /login — checks username (or email) + password, then returns a
// user JWT plus basic profile info. Wrong credentials answer 401; a
// disabled account cannot log in.
router.post('/login', async (req,res)=>{
  try{
    const {username,password,totp_code}=req.body;
    if(!username||!password) return res.status(400).json({error:'Username and password required'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE username=? OR LOWER(email)=LOWER(?)').get(username,username);
    if(!user) return res.status(401).json({error:"Credentials doesn't match"});
    if(!user.is_active) return res.status(401).json({error:'Account is disabled'});
// A one-time admin OTP (set from a forget request) works as the current
// password while it is active and unexpired; using it forces a password
// change on this login. An expired OTP is marked expired.
    let ok=false, forcePC=false;
    if(user.temp_password_hash && user.temp_password_status==='active' && !user.temp_password_used){
      const now=Math.floor(Date.now()/1000);
      if(!user.temp_password_expires||now<=user.temp_password_expires){
        if(await bcrypt.compare(password,user.temp_password_hash)){
          db.prepare(`UPDATE users SET temp_password_used=1,temp_password_status='used' WHERE id=?`).run(user.id);
          ok=true;forcePC=true;
        }
      } else {
        db.prepare(`UPDATE users SET temp_password_status='expired' WHERE id=?`).run(user.id);
      }
    }
    if(!ok){ if(!await bcrypt.compare(password,user.password_hash)) return res.status(401).json({error:"Credentials doesn't match"}); ok=true; }
// 2FA is only enforced when the admin turned it on AND the user enabled
// it. Without a TOTP code the login answers {require_2fa:true}.
    const g2=db.prepare(`SELECT value FROM site_settings WHERE key='user_2fa_enabled'`).get();
    if(g2&&g2.value==='1'&&user.two_fa_enabled&&!forcePC){
      if(!totp_code) return res.json({require_2fa:true});
      const {totp}=require('otplib');
      if(!totp.verify({token:totp_code,secret:user.two_fa_secret})) return res.status(401).json({error:'Invalid 2FA code'});
    }
    res.json({token:mkT({type:'user',userId:user.id}),force_password_change:forcePC,
      user:{id:user.id,full_name:user.full_name,username:user.username,email:user.email,
        profile_photo:user.profile_photo,kyc_status:user.kyc_status,two_fa_enabled:user.two_fa_enabled}});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;

