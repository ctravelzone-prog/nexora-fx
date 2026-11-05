// twofa.js — 2FA setup/verify/disable (clean template literals)
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

router.get('/status', authImpersonation, (req,res)=>{
  const db=getDb();
  const g2=db.prepare(`SELECT value FROM site_settings WHERE key='user_2fa_enabled'`).get();
  const user=db.prepare('SELECT two_fa_enabled FROM users WHERE id=?').get(req.userId);
  res.json({admin_enabled:g2?g2.value==='1':false,user_enabled:user.two_fa_enabled===1});
});

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
