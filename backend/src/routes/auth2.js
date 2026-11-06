// routes/auth2.js — email verification and password recovery.
// GET /verify-email confirms a registration link (24h token). POST
// /forget-request lets a user message the admin for a password reset (the
// admin replies with a one-time 8-digit OTP). POST /reset-via-authenticator
// issues a 10-minute reset token after a valid TOTP code. POST
// /forgot-password and /reset-password are the email-link flow: they only
// send mail when SMTP is configured, otherwise the reset link is logged
// to the server console (dev only) and the endpoint answers 503.
// Rate limits: forget requests 20/hour per IP, authenticator resets 10/15 min.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const emailSvc = require('../services/emailService');
// Abuse guards: forget-request is capped at 20/hour per IP, and
// authenticator-based reset at 10 attempts per 15 minutes per IP.

const rateLimit = require('express-rate-limit');
const forgetLimiter = rateLimit({windowMs:60*60*1000,max:20,handler:(req,res)=>res.status(429).json({error:'Too many forget requests from this connection. Please try again later.'}),standardHeaders:false,legacyHeaders:false});
const authResetLimiter = rateLimit({windowMs:15*60*1000,max:10,handler:(req,res)=>res.status(429).json({error:'Too many attempts. Please try again later.'}),standardHeaders:false,legacyHeaders:false});
// GET /verify-email?token=… — marks the user's email verified when the
// token matches and has not expired (24 hours).
router.get('/verify-email',(req,res)=>{
  const {token}=req.query;
  const db=getDb();
  const user=db.prepare('SELECT * FROM users WHERE email_verify_token=?').get(token);
  if(!user||Math.floor(Date.now()/1000)>user.email_verify_expires)
    return res.status(400).json({error:'Invalid or expired token'});
  db.prepare('UPDATE users SET email_verified=1,email_verify_token=NULL,email_verify_expires=NULL WHERE id=?').run(user.id);
  res.json({success:true,message:'Email verified successfully'});
});

// POST /forget-request — user asks the admin for help (email + contact
// required, message optional). Creates a forget_requests row and an admin
// notification. Guards: one pending request per user, and a 1-hour
// cooldown after a rejection. Showcase accounts cannot use it.
// Honeypot field: bots fill 'website', real users never see it — a
// filled value is silently accepted without creating a request.
// POST /reset-via-authenticator — verifies the user's TOTP code, then
// issues a reset token valid for 10 minutes. Requires 2FA to be enabled
// on the account; otherwise the user must use Message Admin.
// POST /forgot-password — email-link reset. Always answers success when
// SMTP is configured (never reveals whether the email exists). Without
// SMTP it answers 503 and logs the link to the console (dev only).
router.post('/forget-request', forgetLimiter, async (req,res)=>{
  try{
    const {username,email,contact,message,website}=req.body;
    if(website) return res.json({success:true,message:'Request sent to admin.'});
    if(!email) return res.status(400).json({error:'Email is required'});
    if(!contact||!String(contact).trim()) return res.status(400).json({error:'Contact is required so admin can reach you'});
    if(String(contact).length>100||String(message||'').length>1000) return res.status(400).json({error:'Contact or message is too long'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE LOWER(email)=? AND is_showcase=0').get(String(email).trim().toLowerCase());
    if(!user) return res.status(404).json({error:'Email does not match any account'});
    if(!user.is_active) return res.status(400).json({error:'Account is disabled. Contact admin.'});
    const now=Math.floor(Date.now()/1000);
    const last=db.prepare('SELECT * FROM forget_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(user.id);
    if(last&&last.status==='rejected'&&last.created_at>now-3600) return res.status(429).json({error:'Your last request was rejected recently. Please try again later.'});
    const pending=db.prepare("SELECT id FROM forget_requests WHERE user_id=? AND status IN ('pending','otp_sent')").get(user.id);
    if(pending) return res.json({success:true,already_pending:true,message:'Your request is already pending. Please wait for admin.'});
    const rid=db.prepare('INSERT INTO forget_requests (user_id,contact,message) VALUES (?,?,?)').run(user.id,String(contact).trim(),message?String(message).trim():null).lastInsertRowid;
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)').run('forget_request',`Password Forget Request: ${user.full_name} (@${user.username})`,`Contact: ${String(contact).trim()}${message?` | Message: ${String(message).trim()}`:''}`,rid,'forget_request','forget-requests');
    res.json({success:true,message:'Request sent to admin.'});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/reset-via-authenticator', authResetLimiter, async (req,res)=>{
  try{
    const {account,code}=req.body;
    if(!account||!code) return res.status(400).json({error:'Username/email and authenticator code are required'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE (username=? OR email=?) AND is_showcase=0').get(String(account).trim(),String(account).trim());
    if(!user) return res.status(404).json({error:'Account not found'});
    if(!user.is_active) return res.status(400).json({error:'Account is disabled. Contact admin.'});
    if(!user.two_fa_enabled||!user.two_fa_secret) return res.status(400).json({error:'Authenticator is not enabled for this account. Use Message Admin instead.'});
    const {authenticator}=require('otplib');
    if(!authenticator.verify({token:String(code).trim(),secret:user.two_fa_secret})) return res.status(400).json({error:'Invalid authenticator code'});
    const token=require('uuid').v4();
    db.prepare('UPDATE users SET reset_token=?,reset_token_expires=? WHERE id=?').run(token,Math.floor(Date.now()/1000)+600,user.id);
    res.json({success:true,reset_token:token});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/forgot-password', async (req,res)=>{
  try{
    const {email}=req.body;
    if(!email) return res.status(400).json({error:'Email required'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    const token=uuidv4(), expires=Math.floor(Date.now()/1000)+3600;
    if(user) db.prepare('UPDATE users SET reset_token=?,reset_token_expires=? WHERE id=?').run(token,expires,user.id);
    const su=process.env.SITE_URL||'http://localhost:3000';
    if(!emailSvc.isSmtpConfigured()){
      if(user) console.log(`[DEV] Password reset: ${su}/reset-password?token=${token}`);
      return res.status(503).json({error:'Email is not configured — contact admin. Reset link logged to console (dev only).'});
    }
    if(user) await emailSvc.sendResetEmail(email,token,su);
    res.json({success:true,message:'If that email exists, a reset link was sent.'});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /reset-password — sets a new password with a valid, unexpired
// reset token (1 hour). Clears the token after use.
router.post('/reset-password', async (req,res)=>{
  try{
    const {token,password}=req.body;
    if(!token||!password) return res.status(400).json({error:'Token and password required'});
    if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
    if(!user||Math.floor(Date.now()/1000)>user.reset_token_expires)
      return res.status(400).json({error:'Invalid or expired token'});
    const hash=await bcrypt.hash(password,12);
    db.prepare('UPDATE users SET password_hash=?,reset_token=NULL,reset_token_expires=NULL WHERE id=?').run(hash,user.id);
    res.json({success:true,message:'Password reset successfully.'});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
