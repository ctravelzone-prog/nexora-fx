// routes/admin/forget.js — admin side of password-reset requests.
// GET / lists forget requests (pending first). GET /:id/chat returns one
// ticket with its live chat thread; POST /:id/message replies in it.
// POST /:id/generate-otp (Super Admin only) creates an 8-digit OTP that
// works as the user's current password for 24 hours, returns it ONCE to
// the admin AND posts it into the ticket's live chat. POST /:id/reject
// turns a request down (and revokes any OTP already sent for it).
// Rule: the OTP stays usable for 24 hours and can log in many times —
// it stops working only when the user changes their password (then the
// request is marked completed) or it expires.
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
// (bcrypt-hashed, 24h, multi-use until the password changes) and returns
// the plain code ONCE, and posts it into the ticket's live chat so the
// user sees it there. The OTP is stored hashed on the user row; the
// plain code appears only in this response and the chat message.
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
    db.prepare('INSERT INTO forget_request_messages (request_id,sender_type,sender_id,message) VALUES (?,?,?,?)').run(fr.id,'admin',req.adminId,`🔐 Your one-time code: ${otp} — valid 24 hours. You can log in with it as many times as you like until you change your password.`);
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

// GET /:id/chat — one ticket with its live chat thread (admin view).
router.get('/:id/chat', authAdmin, (req,res)=>{
  const db=getDb();
  const fr=db.prepare('SELECT fr.*,u.full_name,u.username,u.email FROM forget_requests fr JOIN users u ON fr.user_id=u.id WHERE fr.id=?').get(req.params.id);
  if(!fr) return res.status(404).json({error:'Request not found'});
  const messages=db.prepare('SELECT * FROM forget_request_messages WHERE request_id=? ORDER BY created_at').all(fr.id);
  res.json({request:{id:fr.id,status:fr.status,contact:fr.contact,message:fr.message,created_at:fr.created_at,full_name:fr.full_name,username:fr.username,email:fr.email},messages});
});

// POST /:id/message — admin replies in the ticket's live chat.
router.post('/:id/message', authAdmin, (req,res)=>{
  const {message}=req.body;
  if(!message||!String(message).trim()) return res.status(400).json({error:'Write a reply'});
  const db=getDb();
  const fr=db.prepare('SELECT * FROM forget_requests WHERE id=?').get(req.params.id);
  if(!fr) return res.status(404).json({error:'Request not found'});
  if(!['pending','otp_sent'].includes(fr.status)) return res.status(400).json({error:'This ticket is closed'});
  const mid=db.prepare('INSERT INTO forget_request_messages (request_id,sender_type,sender_id,message) VALUES (?,?,?,?)').run(fr.id,'admin',req.adminId,String(message).trim().substring(0,2000)).lastInsertRowid;
  db.prepare('UPDATE forget_requests SET updated_at=unixepoch() WHERE id=?').run(fr.id);
  res.json({success:true,message_id:mid});
});

module.exports = router;
