// routes/admin/forget.js — admin side of password-reset requests.
// GET / lists forget requests (pending first). POST /:id/generate-otp
// (Super Admin only) creates a one-time 8-digit OTP that works as the
// user's current password for 24 hours, and returns it ONCE to the admin
// (the admin passes it to the user out of band). POST /:id/reject turns
// a request down (and revokes any OTP already sent for it).
// Rule: the user then changes their password with the OTP as the current
// password; using it clears the OTP and marks the request completed.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');

// GET / — all forget requests with user name/username, pending first.
router.get('/', authAdmin, (req,res)=>{
  const rows=getDb().prepare(`SELECT fr.*,u.full_name,u.username,u.email FROM forget_requests fr JOIN users u ON fr.user_id=u.id ORDER BY CASE WHEN fr.status='pending' THEN 0 WHEN fr.status='otp_sent' THEN 1 ELSE 2 END, fr.created_at DESC`).all();
  res.json(rows);
});

// POST /:id/generate-otp — Super Admin only. Generates the 8-digit OTP
// (bcrypt-hashed, 24h, one use) and returns the plain code ONCE.
// The OTP is stored hashed; the plain code is never stored anywhere.
router.post('/:id/generate-otp', authAdmin, superAdminOnly, async (req,res)=>{
  try{
    const db=getDb();
    const fr=db.prepare('SELECT * FROM forget_requests WHERE id=?').get(req.params.id);
    if(!fr) return res.status(404).json({error:'Request not found'});
    if(!['pending','otp_sent'].includes(fr.status)) return res.status(400).json({error:'This request is already closed'});
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(fr.user_id);
    if(!user) return res.status(404).json({error:'User not found'});
    if(!user.is_active) return res.status(400).json({error:'Account is disabled'});
    const otp=crypto.randomInt(10000000,100000000).toString();
    const hash=await bcrypt.hash(otp,12);
    db.prepare(`UPDATE users SET temp_password_hash=?,temp_password_expires=?,temp_password_used=0,temp_password_status='active' WHERE id=?`).run(hash,Math.floor(Date.now()/1000)+86400,user.id);
    db.prepare(`UPDATE forget_requests SET status='otp_sent',updated_at=unixepoch() WHERE id=?`).run(fr.id);
    db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'forget_otp_generated');
    res.json({success:true,otp});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /:id/reject — rejects the request (revokes any OTP already sent
// for it). The user must wait 1 hour before sending a new request.
router.post('/:id/reject', authAdmin, (req,res)=>{
  const db=getDb();
  const fr=db.prepare('SELECT * FROM forget_requests WHERE id=?').get(req.params.id);
  if(!fr) return res.status(404).json({error:'Request not found'});
  if(!['pending','otp_sent'].includes(fr.status)) return res.status(400).json({error:'This request is already closed'});
  if(fr.status==='otp_sent') db.prepare(`UPDATE users SET temp_password_hash=NULL,temp_password_status='revoked',temp_password_used=0,temp_password_expires=NULL WHERE id=?`).run(fr.user_id);
  db.prepare(`UPDATE forget_requests SET status='rejected',updated_at=unixepoch() WHERE id=?`).run(fr.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,fr.user_id,'forget_request_rejected');
  res.json({success:true});
});

module.exports = router;
