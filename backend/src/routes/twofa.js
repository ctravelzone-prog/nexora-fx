// routes/twofa.js — user two-factor authentication (TOTP via otplib).
// GET /status reports whether the admin enabled 2FA and whether this user
// has it on. GET /setup generates a secret + QR code (requires the admin
// switch on). POST /verify checks the first TOTP code and enables 2FA.
// POST /disable turns it off after a valid code.
// Rule: 2FA only works when the admin enabled it in 2FA Control; login
// then asks for the code (see routes/auth.js). Backup codes are shown
// once at setup and are not stored.
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

// GET /status — whether 2FA is enabled by the admin and by this user.
router.get('/status', authImpersonation, (req,res)=>{
  const db=getDb();
  const g2=db.prepare(`SELECT value FROM site_settings WHERE key='user_2fa_enabled'`).get();
  const user=db.prepare('SELECT two_fa_enabled FROM users WHERE id=?').get(req.userId);
  res.json({admin_enabled:g2?g2.value==='1':false,user_enabled:user.two_fa_enabled===1});
});

// GET /setup — generates a new TOTP secret, saves it on the user row,
// and returns the secret + QR code + manual key for the authenticator
// app. Refused when the admin switch is off or 2FA is already on.
router.get('/setup', authImpersonation, async (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const db=getDb();
    const g2=db.prepare(`SELECT value FROM site_settings WHERE key='user_2fa_enabled'`).get();
    if(!g2||g2.value!=='1') return res.status(403).json({error:'2FA is currently disabled by admin'});
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.userId);
    if(user.two_fa_enabled) return res.status(400).json({error:'2FA already enabled'});
    const secret=authenticator.generateSecret();
    db.prepare('UPDATE users SET two_fa_secret=? WHERE id=?').run(secret,req.userId);
    const otpauth=authenticator.keyuri(user.email,'NexoraFx',secret);
    const qrDataUrl=await qrcode.toDataURL(otpauth);
    res.json({secret,qr:qrDataUrl,manual_key:secret});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /verify — checks the TOTP code against the saved secret; on
// success sets two_fa_enabled=1 and returns 8 one-time backup codes.
router.post('/verify', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const{code}=req.body;
  if(!code) return res.status(400).json({error:'Code required'});
  const db=getDb();
  const g2=db.prepare(`SELECT value FROM site_settings WHERE key='user_2fa_enabled'`).get();
  if(!g2||g2.value!=='1') return res.status(403).json({error:'2FA is currently disabled by admin'});
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.userId);
  if(!user.two_fa_secret) return res.status(400).json({error:'Run setup first'});
  if(!authenticator.verify({token:code,secret:user.two_fa_secret})) return res.status(400).json({error:'Invalid code'});
  const backupCodes=Array.from({length:8},()=>Math.random().toString(36).substring(2,10).toUpperCase());
  db.prepare('UPDATE users SET two_fa_enabled=1 WHERE id=?').run(req.userId);
  res.json({success:true,backup_codes:backupCodes,message:'2FA enabled successfully'});
});

// POST /disable — turns 2FA off after a valid TOTP code and clears
// the saved secret.
router.post('/disable', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const{code}=req.body;
  if(!code) return res.status(400).json({error:'Code required'});
  const db=getDb();
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.userId);
  if(!user.two_fa_enabled) return res.status(400).json({error:'2FA not enabled'});
  if(!authenticator.verify({token:code,secret:user.two_fa_secret})) return res.status(400).json({error:'Invalid code'});
  db.prepare('UPDATE users SET two_fa_enabled=0,two_fa_secret=NULL WHERE id=?').run(req.userId);
  res.json({success:true,message:'2FA disabled'});
});

module.exports = router;
