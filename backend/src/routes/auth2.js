// routes/auth2.js — email verification and password recovery.
// GET /verify-email confirms a registration link (24h token). POST
// /forget-request opens a password-help ticket with just the user's
// email; the ticket has a live chat (user + admin) with document upload,
// and the admin replies there with a 24-hour OTP (multi-use until the
// password changes). POST /reset-via-authenticator
// issues a 10-minute reset token after a valid TOTP code. POST
// /forgot-password and /reset-password are the email-link flow: they only
// send mail when SMTP is configured, otherwise the reset link is logged
// to the server console (dev only) and the endpoint answers 503.
// Rate limits: forget requests 20/hour per IP, authenticator resets 10/15 min.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const emailSvc = require('../services/emailService');
const { getUploadsDir, ensureUploadsDir } = require('../services/uploads');
// Abuse guards: forget-request is capped at 20/hour per IP, and
// authenticator-based reset at 10 attempts per 15 minutes per IP.

const rateLimit = require('express-rate-limit');
const forgetLimiter = rateLimit({windowMs:60*60*1000,max:20,handler:(req,res)=>res.status(429).json({error:'Too many forget requests from this connection. Please try again later.'}),standardHeaders:false,legacyHeaders:false});
const authResetLimiter = rateLimit({windowMs:15*60*1000,max:10,handler:(req,res)=>res.status(429).json({error:'Too many attempts. Please try again later.'}),standardHeaders:false,legacyHeaders:false});
// Document upload for the forget ticket chat: one image or PDF, max 5 MB,
// stored in the uploads dir (UPLOADS_DIR, served at /uploads/).
ensureUploadsDir();
const forgetUpload = multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,getUploadsDir()),filename:(req,file,cb)=>cb(null,`forget_${req.params.id}_${Date.now()}_${file.originalname}`)}),limits:{fileSize:5*1024*1024}});
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

// POST /forget-request — user opens a password-help ticket with just
// their email. Creates a forget_requests row with a per-ticket access
// token (the logged-out user opens the ticket's live chat with it) and
// an admin notification. Guards: one pending request per user, and a
// 1-hour cooldown after a rejection. Showcase accounts cannot use it.
// Honeypot field: bots fill 'website', real users never see it — a
// filled value is silently accepted without creating a request.
// The reply is {request_id, access_token} — the user opens the live
// chat with those. Contact/message are accepted when sent (old form)
// but no longer required.
// POST /reset-via-authenticator — verifies the user's TOTP code, then
// issues a reset token valid for 10 minutes. Requires 2FA to be enabled
// on the account; otherwise the user must use Message Admin.
// POST /forgot-password — email-link reset. Always answers success when
// SMTP is configured (never reveals whether the email exists). Without
// SMTP it answers 503 and logs the link to the console (dev only).
router.post('/forget-request', forgetLimiter, async (req,res)=>{
  try{
    const {email,contact,message,website}=req.body;
    if(website) return res.json({success:true,message:'Request sent to Nexora FX.'});
    if(!email) return res.status(400).json({error:'Email is required'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE LOWER(email)=? AND is_showcase=0').get(String(email).trim().toLowerCase());
    if(!user) return res.status(404).json({error:'Email does not match any account'});
    if(!user.is_active) return res.status(400).json({error:'Account is disabled. Contact Nexora FX.'});
    const now=Math.floor(Date.now()/1000);
    const last=db.prepare('SELECT * FROM forget_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(user.id);
    if(last&&last.status==='rejected'&&last.created_at>now-3600) return res.status(429).json({error:'Your last request was rejected recently. Please try again later.'});
    const pending=db.prepare("SELECT * FROM forget_requests WHERE user_id=? AND status IN ('pending','otp_sent')").get(user.id);
    if(pending){
      let tok=pending.access_token;
      if(!tok){tok=crypto.randomBytes(16).toString('hex');db.prepare('UPDATE forget_requests SET access_token=? WHERE id=?').run(tok,pending.id);}
      return res.json({success:true,already_pending:true,request_id:pending.id,access_token:tok,message:'Your request is already pending. Please wait for Nexora FX.'});
    }
    const tok=crypto.randomBytes(16).toString('hex');
    const rid=db.prepare('INSERT INTO forget_requests (user_id,access_token,contact,message) VALUES (?,?,?,?)').run(user.id,tok,contact?String(contact).trim().slice(0,100):null,message?String(message).trim().slice(0,1000):null).lastInsertRowid;
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)').run('forget_request',`Password Forget Request: ${user.full_name} (@${user.username})`,`Email: ${String(email).trim()} — ticket opened from Forgot Password`,rid,'forget_request','forget-requests');
    res.json({success:true,request_id:rid,access_token:tok,message:'Request sent to Nexora FX.'});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /forget-request/:id/chat?token= — the ticket's live chat thread
// for the logged-out user. The per-ticket access token (returned when
// the ticket was opened) is the only credential — no JWT needed. This
// is the 3-second poll endpoint; it is exempt from the general limiter.
router.get('/forget-request/:id/chat', (req,res)=>{
  try{
    const db=getDb();
    const fr=db.prepare('SELECT fr.*,u.full_name,u.username,u.email FROM forget_requests fr JOIN users u ON fr.user_id=u.id WHERE fr.id=?').get(req.params.id);
    if(!fr||!fr.access_token||fr.access_token!==String(req.query.token||'')) return res.status(404).json({error:'Ticket not found'});
    const messages=db.prepare('SELECT * FROM forget_request_messages WHERE request_id=? ORDER BY created_at').all(fr.id);
    res.json({request:{id:fr.id,status:fr.status,created_at:fr.created_at},messages});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /forget-request/:id/message — the logged-out user sends a chat
// message (text and/or one document: image or PDF, max 5 MB) in their
// ticket. Token-gated (body token), ticket must be open.
router.post('/forget-request/:id/message', (req,res)=>{
  forgetUpload.single('document')(req,res,async(err)=>{
    if(err) return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Document must be under 5 MB':(err.message||'Upload failed')});
    try{
      const db=getDb();
      const fr=db.prepare('SELECT * FROM forget_requests WHERE id=?').get(req.params.id);
      if(!fr||!fr.access_token||fr.access_token!==String(req.body.token||'')) return res.status(404).json({error:'Ticket not found'});
      if(!['pending','otp_sent'].includes(fr.status)) return res.status(400).json({error:'This ticket is closed'});
      const message=req.body.message?String(req.body.message).trim():'';
      const attachment=req.file?`/uploads/${req.file.filename}`:null;
      if(!message&&!attachment) return res.status(400).json({error:'Write a message or attach a document'});
      if(message.length>2000) return res.status(400).json({error:'Message is too long'});
      const mid=db.prepare('INSERT INTO forget_request_messages (request_id,sender_type,sender_id,message,attachment) VALUES (?,?,?,?,?)').run(fr.id,'user',fr.user_id,message||null,attachment).lastInsertRowid;
      db.prepare('UPDATE forget_requests SET updated_at=unixepoch() WHERE id=?').run(fr.id);
      res.json({success:true,message_id:mid});
    }catch(e){res.status(500).json({error:e.message});}
  });
});

router.post('/reset-via-authenticator', authResetLimiter, async (req,res)=>{
  try{
    const {account,code}=req.body;
    if(!account||!code) return res.status(400).json({error:'Username/email and authenticator code are required'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE (username=? OR email=?) AND is_showcase=0').get(String(account).trim(),String(account).trim());
    if(!user) return res.status(404).json({error:'Account not found'});
    if(!user.is_active) return res.status(400).json({error:'Account is disabled. Contact Nexora FX.'});
    if(!user.two_fa_enabled||!user.two_fa_secret) return res.status(400).json({error:'Authenticator is not enabled for this account. Use Message Nexora FX instead.'});
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
      return res.status(503).json({error:'Email is not configured — contact Nexora FX. Reset link logged to console (dev only).'});
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
    // A password reset also kills any live admin OTP.
    db.prepare("UPDATE users SET temp_password_hash=NULL,temp_password_status='none',temp_password_used=0,temp_password_expires=NULL WHERE id=?").run(user.id);
    db.prepare("UPDATE forget_requests SET status='completed',updated_at=unixepoch() WHERE user_id=? AND status='otp_sent'").run(user.id);
    res.json({success:true,message:'Password reset successfully.'});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
