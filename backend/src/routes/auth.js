// auth.js — register + login (fixed: SQL uses template literals)
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const { getOrCreateBalance } = require('../services/moneyHelpers');
const emailSvc = require('../services/emailService');
function mkT(p){return jwt.sign(p,process.env.JWT_SECRET,{expiresIn:'7d'});}

router.post('/register', async (req,res)=>{
  try{
    const {full_name,username,email,phone,country_code,password,referral_code}=req.body;
    if(!full_name||!username||!email||!password) return res.status(400).json({error:'Required fields missing'});
    if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    const db=getDb();
    if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(400).json({error:'Email already registered'});
    if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken'});
    const hash=await bcrypt.hash(password,12);
    const vt=uuidv4(), ve=Math.floor(Date.now()/1000)+86400;
    let refById=null;
    if(referral_code){const r=db.prepare('SELECT id FROM users WHERE referral_code=? OR username=?').get(referral_code,referral_code);if(r)refById=r.id;}
    const rc=Math.random().toString(36).substring(2,10).toUpperCase();
    const uid=db.prepare('INSERT INTO users (full_name,username,email,phone,country_code,password_hash,referral_code,referred_by_user_id,email_verify_token,email_verify_expires) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(full_name,username,email,phone||null,country_code||'+44',hash,rc,refById,vt,ve).lastInsertRowid;
    getOrCreateBalance(uid);
    if(refById) db.prepare('INSERT OR IGNORE INTO referrals (referrer_user_id,referred_user_id) VALUES (?,?)').run(refById,uid);
    const su=process.env.SITE_URL||'http://localhost:3000';
    if(emailSvc.isSmtpConfigured()) await emailSvc.sendVerifyEmail(email,vt,su);
    else console.log(`[DEV] Email verify: ${su}/verify-email?token=${vt}`);
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('new_user',`New User Joined — ${full_name} (@${username})`,`New registration · ${email}`,uid,'user','users');
    res.json({success:true,message:'Registration successful.'});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/login', async (req,res)=>{
  try{
    const {username,password,totp_code}=req.body;
    if(!username||!password) return res.status(400).json({error:'Username and password required'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE username=? OR email=?').get(username,username);
    if(!user) return res.status(401).json({error:"Credentials doesn't match"});
    if(!user.is_active) return res.status(401).json({error:'Account is disabled'});
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

