// routes/user.js — user profile, balances, transactions, notifications.
// GET /me returns the profile + balances (the dashboard reads this).
// PUT /profile edits name/phone, /profile-photo uploads or removes the
// avatar, /change-password changes the password (an admin OTP also works
// as the current password). GET /transactions is the History list,
// /notifications lists and marks the user's notifications, /settings
// returns the public site settings.
// Rules: showcase accounts (is_showcase=1) live in the separate showcase
// database and CAN log in and do everything a real user can; their money
// never appears in admin totals, ledgers or reports.
// Their balances live on the users row and show on the admin Showcase
// page. All write routes refuse impersonation sessions (admin 'Login
// as User'); reads allow both normal and impersonation tokens.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { getDb } = require('../models/database');
const { USERNAME_RE, suggestUsernames } = require('../services/usernameService');
const { authUser, authImpersonation } = require('../middleware/auth');
const { getBalance, getMoneySettings, calcMainWithdrawFee, fmtC } = require('../services/moneyHelpers');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { getUploadsDir, ensureUploadsDir } = require('../services/uploads');
ensureUploadsDir();
const PROFILE_PHOTO_EXTS = new Set(['.jpg','.jpeg','.png','.webp','.gif','.heic','.heif']);
// Profile photos are kept separate by user type: real users under
// profile/real, showcase users under profile/showcase — so a showcase
// photo can never mix with a real user's photo (and vice versa).
function profilePhotoDir(req){
  return req.isShowcase ? 'profile/showcase' : 'profile/real';
}
const storage = multer.diskStorage({
  destination: (req,file,cb)=>{
    const dir = path.join(getUploadsDir(), profilePhotoDir(req));
    try{ fs.mkdirSync(dir, {recursive:true}); }catch(_){}
    cb(null, dir);
  },
  filename: (req,file,cb)=>{
    const ext = path.extname(file.originalname||'').toLowerCase();
    const safeExt = PROFILE_PHOTO_EXTS.has(ext) ? ext : '.jpg';
    cb(null,`profile_${req.userId||Date.now()}_${Date.now()}${safeExt}`);
  }
});
const upload = multer({storage,limits:{fileSize:10*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(file.mimetype && file.mimetype.startsWith('image/')) return cb(null,true);
    cb(new Error('Only image files are allowed'));
  }});

// Deletes one uploaded profile photo file, but only if it lives inside
// the uploads dir in an allowed spot — profile/real/…, profile/showcase/…,
// or a plain profile_* file directly under /uploads (older uploads, before
// the split) — never an arbitrary path.
const PROFILE_FILE_RE = /^(profile\/(real|showcase)\/)?profile_[A-Za-z0-9._-]+$/;
function deleteUploadFile(url){
  if(!url || typeof url !== 'string') return;
  if(!url.startsWith('/uploads/')) return;
  const rel = url.slice('/uploads/'.length);
  if(!PROFILE_FILE_RE.test(rel)) return;
  try{ fs.unlinkSync(path.join(getUploadsDir(), rel)); }catch(_){}
}

// Runs multer.single('photo') and turns its errors into a JSON 400
// (a bare upload.single() lets Express answer an HTML 500, which the
// frontend can only show as a bare "HTTP 500").
function uploadPhoto(req,res,next){
  upload.single('photo')(req,res,(err)=>{
    if(err){
      if(err.code==='LIMIT_FILE_SIZE') return res.status(400).json({error:'Photo must be under 10 MB'});
      return res.status(400).json({error:err.message||'Upload failed'});
    }
    next();
  });
}

// Reads allow both a normal user token and an admin impersonation
// token; every write route below still refuses impersonation itself.
const auth = authImpersonation; // allow both normal and impersonation tokens

// GET /me — profile + balances + withdrawable fee. (The showcase
// display-balance fallback below is unreachable now — showcase accounts
// the showcase database — kept as a safety net; showcase balances never
// come from the real balances table.)
// GET /api/user/me
router.get('/me', auth, (req,res)=>{
  const db=getDb();
  const user=req.user;
  const bal=getBalance(user.id);
  // Showcase users (separate showcase DB): display balances come from
  // the showcase_*_cents fields on their users row:
  // the admin-set DISPLAY balances live on the users row
  // (showcase_*_cents), not in the real balances table.
  if(user.is_showcase===1){
    bal.main_cents=user.showcase_main_cents||0;
    bal.copy_cents=user.showcase_copy_cents||0;
    bal.profit_cents=user.showcase_profit_cents||0;
    bal.referral_cents=0;
    bal.referral_transferred_cents=0;
    bal.total_deposited_cents=(user.showcase_main_cents||0)+(user.showcase_copy_cents||0);
    bal.total_withdrawn_cents=user.showcase_withdraw_cents||0;
  }
  const total=bal.main_cents+bal.copy_cents+bal.profit_cents;
  // Per-user access controls (Money Settings): which deposit/withdraw kinds
  // the admin blocked for this user, and whether Request Money is on.
  const blocks=db.prepare('SELECT kind FROM user_blocks WHERE user_id=?').all(user.id).map(r=>r.kind);
  const rmFlag=db.prepare('SELECT request_money_enabled FROM users WHERE id=?').get(user.id);
  const s=getMoneySettings();
  const feeCents=calcMainWithdrawFee(user.id,bal.main_cents,s);
  res.json({user:{id:user.id,full_name:user.full_name,username:user.username,
    email:user.email,phone:user.phone,country_code:user.country_code,
    profile_photo:user.profile_photo,kyc_status:user.kyc_status,kyc_requested:user.kyc_requested||0,
    email_verified:user.email_verified,two_fa_enabled:user.two_fa_enabled,
    referral_code:user.referral_code,created_at:user.created_at,
    blocks,request_money_enabled:rmFlag?rmFlag.request_money_enabled:1},
    balance:{main_cents:bal.main_cents,copy_cents:bal.copy_cents,
      profit_cents:bal.profit_cents,referral_cents:bal.referral_cents,
      referral_available_cents:Math.max(0,(bal.referral_cents||0)-(bal.referral_transferred_cents||0)),
      referral_transferred_cents:bal.referral_transferred_cents||0,
      total_cents:total,total_deposited_cents:bal.total_deposited_cents,
      total_withdrawn_cents:bal.total_withdrawn_cents,
      first_deposit_at:bal.first_deposit_at},
    early_fee_cents:feeCents,is_impersonation:req.isImpersonation||false});
});

// PUT /api/user/profile
// PUT /profile — updates full_name and username ONLY (the only fields a
// user may change directly). Email and phone change only through an
// admin-approved request (POST /profile-change-request below), so they
// are never updated here even if sent. Username must be unique —
// another user's name answers 400 'Username already taken'.
router.put('/profile', auth, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const {full_name,username}=req.body;
  const db=getDb();
  const me=db.prepare('SELECT username FROM users WHERE id=?').get(req.userId);
  if(!me) return res.status(404).json({error:'User not found'});
  const newName=(username||'').trim();
  if(newName && newName!==me.username){
    if(!USERNAME_RE.test(newName)) return res.status(400).json({error:'Username can only use lowercase letters, numbers, - and _',suggestion:suggestUsernames(db,newName,1)[0]});
    if(db.prepare('SELECT id FROM users WHERE username=? AND id<>?').get(newName,req.userId)) return res.status(400).json({error:'Username already taken',suggestion:suggestUsernames(db,newName,1)[0]});
  }
  const newFull=(full_name||'').trim();
  if(newFull==='') return res.status(400).json({error:'Full name is required'});
  db.prepare('UPDATE users SET full_name=?,username=COALESCE(?,username),updated_at=unixepoch() WHERE id=?')
    .run(newFull,newName||null,req.userId);
  res.json({success:true});
});

// Normalize a phone number to digits-only with country code, so the same
// number in different formats (+8801712..., 01712...) matches as one.
// Mirrors the normalizePhone in routes/auth.js — keep the two in sync.
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

// POST /profile-change-request — user asks the admin to change their
// email or phone. The change applies ONLY when the admin approves it.
// One pending request per field per user; a taken value is rejected.
router.post('/profile-change-request', auth, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const {field,new_value,country_code}=req.body;
  if(!['email','phone'].includes(field)) return res.status(400).json({error:'Field must be email or phone'});
  const value=String(new_value||'').trim();
  if(!value) return res.status(400).json({error:'New value is required'});
  const db=getDb();
  const me=db.prepare('SELECT full_name,username,email,phone,country_code FROM users WHERE id=?').get(req.userId);
  if(!me) return res.status(404).json({error:'User not found'});
  if(field==='email'){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({error:'Invalid email address'});
    const emailNorm=value.toLowerCase();
    if(emailNorm===String(me.email||'').toLowerCase()) return res.status(400).json({error:'This is already your email'});
    if(db.prepare('SELECT id FROM users WHERE LOWER(email)=? AND id<>?').get(emailNorm,req.userId)) return res.status(400).json({error:'Email already registered'});
  }else{
    const norm=normalizePhone(country_code||me.country_code,value);
    if(!norm) return res.status(400).json({error:'Invalid phone number'});
    if(norm===normalizePhone(me.country_code,me.phone)) return res.status(400).json({error:'This is already your phone number'});
    const taken=db.prepare('SELECT phone,country_code FROM users WHERE phone IS NOT NULL AND phone<>? AND id<>?').all('',req.userId)
      .some(u=>normalizePhone(u.country_code,u.phone)===norm);
    if(taken) return res.status(400).json({error:'Phone number already registered'});
  }
  if(db.prepare("SELECT id FROM profile_change_requests WHERE user_id=? AND field=? AND status='pending'").get(req.userId,field))
    return res.status(400).json({error:'You already have a pending request for this'});
  const oldVal=field==='email'?me.email:me.phone;
  const r=db.prepare('INSERT INTO profile_change_requests (user_id,field,old_value,new_value,country_code) VALUES (?,?,?,?,?)')
    .run(req.userId,field,oldVal||null,value,field==='phone'?(country_code||me.country_code||null):null);
  db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
    .run('profile_request',`Profile change request — ${field}`,`${me.full_name} (@${me.username}) wants to change ${field} to ${value}`,Number(r.lastInsertRowid),'profile_request','profile-requests');
  res.json({success:true,message:'Request sent to Nexora FX. It will apply once approved.'});
});

// GET /profile-change-requests — the user's own change requests, newest first.
router.get('/profile-change-requests', auth, (req,res)=>{
  const rows=getDb().prepare('SELECT * FROM profile_change_requests WHERE user_id=? ORDER BY created_at DESC').all(req.userId);
  res.json(rows);
});

// POST /profile-photo — uploads a new avatar (max 10 MB) and saves its
// /uploads URL on the user row, per user. The previous photo file is
// deleted, so only the latest photo is kept.
// POST /api/user/profile-photo
router.post('/profile-photo', auth, (req,res,next)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  next();
}, uploadPhoto, (req,res)=>{
  if(!req.file) return res.status(400).json({error:'No file uploaded'});
  // req.db is set by auth and travels with the request — getDb() relies on
  // AsyncLocalStorage, which multer's async upload can lose, silently
  // routing the UPDATE to the main DB (0 rows) while still answering success.
  const db = req.db || getDb();
  const old = db.prepare('SELECT profile_photo FROM users WHERE id=?').get(req.userId);
  const url=`/uploads/${profilePhotoDir(req)}/${req.file.filename}`;
  const updated = db.prepare('UPDATE users SET profile_photo=? WHERE id=?').run(url,req.userId);
  if(!updated || updated.changes === 0){
    deleteUploadFile(url);
    return res.status(500).json({error:'Could not save photo. Please try again.'});
  }
  if(old && old.profile_photo && old.profile_photo !== url) deleteUploadFile(old.profile_photo);
  res.json({success:true,url});
});

// DELETE /profile-photo — removes the avatar (sets profile_photo NULL)
// and deletes the photo file, so no old file is left behind.
// DELETE /api/user/profile-photo
router.delete('/profile-photo', auth, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const db = req.db || getDb();
  const old = db.prepare('SELECT profile_photo FROM users WHERE id=?').get(req.userId);
  db.prepare('UPDATE users SET profile_photo=NULL WHERE id=?').run(req.userId);
  if(old && old.profile_photo) deleteUploadFile(old.profile_photo);
  res.json({success:true});
});

// POST /change-password — checks the current password (a still-valid
// admin OTP also counts), then sets the new one. Any password change
// kills a live admin OTP: the OTP works many times within 24 hours, but
// stops the moment the password changes. Minimum 8 characters.
// POST /api/user/change-password
router.post('/change-password', auth, async (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {current_password,new_password}=req.body;
    if(!current_password||!new_password) return res.status(400).json({error:'Both fields required'});
    if(new_password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    const db=getDb();
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.userId);
    let currentOk=await bcrypt.compare(current_password,user.password_hash);
    if(!currentOk&&user.temp_password_hash){const now=Math.floor(Date.now()/1000);const tempOk=(user.temp_password_status==='active'||user.temp_password_status==='used')&&(!user.temp_password_expires||now<=user.temp_password_expires);if(tempOk&&await bcrypt.compare(current_password,user.temp_password_hash)){currentOk=true;}}
    if(!currentOk) return res.status(400).json({error:'Current password is incorrect'});
    const hash=await bcrypt.hash(new_password,12);
    db.prepare('UPDATE users SET password_hash=?,updated_at=unixepoch() WHERE id=?').run(hash,req.userId);
    // Any password change kills a live admin OTP and closes the ticket.
    db.prepare("UPDATE users SET temp_password_hash=NULL,temp_password_status='none',temp_password_used=0,temp_password_expires=NULL WHERE id=?").run(user.id);
    db.prepare("UPDATE forget_requests SET status='completed',updated_at=unixepoch() WHERE user_id=? AND status='otp_sent'").run(user.id);
    res.json({success:true,message:'Password changed successfully'});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /transactions — the user's transaction history, newest first.
// Optional ?type= filter, ?limit= / ?offset= paging (default 50).
// GET /api/user/transactions
router.get('/transactions', auth, (req,res)=>{
  const db=getDb();
  const {type,limit=50,offset=0}=req.query;
  let q='SELECT * FROM transactions WHERE user_id=?';
  const p=[req.userId];
  if(type){q+=' AND type=?';p.push(type);}
  q+=' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// GET /transactions/summary — exact totals for the History summary band:
// total deposits, total withdrawals and total withdraw fees, completed
// rows only. Copy transfers/stops, daily PnL, referral and admin credits
// are internal movements, not money the user put in or took out, so they
// are NOT counted here (counting them inflated TOTAL IN / TOTAL OUT).
// GET /api/user/transactions/summary
router.get('/transactions/summary', auth, (req,res)=>{
  const db=getDb();
  const row=db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN type='deposit' AND status='completed' THEN amount_cents ELSE 0 END),0) AS total_deposit_cents,
    COALESCE(SUM(CASE WHEN type LIKE 'withdraw%' AND status='completed' THEN amount_cents ELSE 0 END),0) AS total_withdraw_cents,
    COALESCE(SUM(CASE WHEN type LIKE 'withdraw%' AND status='completed' THEN fee_cents ELSE 0 END),0) AS total_fee_cents
    FROM transactions WHERE user_id=?`).get(req.userId);
  res.json(row);
});

// GET /notifications — the user's notifications (plus broadcast ones
// with user_id NULL) and the unread count.
// GET /api/user/notifications
router.get('/notifications', auth, (req,res)=>{
  const db=getDb();
  const notifs=db.prepare('SELECT * FROM notifications WHERE user_id=? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50').all(req.userId);
  const unread=notifs.filter(n=>!n.is_read).length;
  res.json({notifications:notifs,unread_count:unread});
});

// PUT /notifications/read-all — marks all of the user's notifications
// (and broadcasts) as read.
// PUT /api/user/notifications/read-all
router.put('/notifications/read-all', auth, (req,res)=>{
  getDb().prepare('UPDATE notifications SET is_read=1 WHERE user_id=? OR user_id IS NULL').run(req.userId);
  res.json({success:true});
});

// PUT /notifications/:id/read — marks one notification as read.
// PUT /api/user/notifications/:id/read
router.put('/notifications/:id/read', auth, (req,res)=>{
  getDb().prepare('UPDATE notifications SET is_read=1 WHERE id=? AND (user_id=? OR user_id IS NULL)').run(req.params.id,req.userId);
  res.json({success:true});
});

// GET /settings — public site settings as one JSON object (same data
// as GET /api/settings in app.js).
// GET /api/user/settings (public site settings)
router.get('/settings', (req,res)=>{
  const db=getDb();
  const rows=db.prepare('SELECT key,value FROM site_settings').all();
  const settings={};
  for(const r of rows) settings[r.key]=r.value;
  res.json(settings);
});

module.exports = router;
