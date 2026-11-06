// routes/admin/profileRequests.js — admin side of profile change requests.
// Users cannot change their own email/phone directly; they request it here
// and the admin approves (the change is applied) or rejects it.
// GET / lists requests with user name/username, pending first.
// POST /:id/approve applies the new email/phone (re-checking it is still
// free) and notifies the user. POST /:id/reject turns it down and notifies.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

// Normalize a phone number to digits-only with country code.
// Mirrors routes/auth.js normalizePhone — keep the two in sync.
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

// GET / — all profile change requests with user name/username, pending first.
router.get('/', authAdmin, (req,res)=>{
  const rows=getDb().prepare(`SELECT pr.*,u.full_name,u.username,u.email FROM profile_change_requests pr JOIN users u ON pr.user_id=u.id ORDER BY CASE WHEN pr.status='pending' THEN 0 ELSE 1 END, pr.created_at DESC`).all();
  res.json(rows);
});

// POST /:id/approve — applies the requested email/phone change.
router.post('/:id/approve', authAdmin, (req,res)=>{
  const db=getDb();
  const pr=db.prepare('SELECT * FROM profile_change_requests WHERE id=?').get(req.params.id);
  if(!pr) return res.status(404).json({error:'Request not found'});
  if(pr.status!=='pending') return res.status(400).json({error:'This request is already closed'});
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(pr.user_id);
  if(!user) return res.status(404).json({error:'User not found'});
  // Re-check the new value is still free — someone may have taken it
  // after the user requested it.
  if(pr.field==='email'){
    const emailNorm=String(pr.new_value).toLowerCase();
    if(db.prepare('SELECT id FROM users WHERE LOWER(email)=? AND id<>?').get(emailNorm,pr.user_id)) return res.status(400).json({error:'Email is now taken by another user'});
    db.prepare('UPDATE users SET email=?,updated_at=unixepoch() WHERE id=?').run(emailNorm,pr.user_id);
  }else{
    const norm=normalizePhone(pr.country_code, pr.new_value);
    const taken=db.prepare('SELECT phone,country_code FROM users WHERE phone IS NOT NULL AND phone<>? AND id<>?').all('',pr.user_id)
      .some(u=>normalizePhone(u.country_code,u.phone)===norm);
    if(taken) return res.status(400).json({error:'Phone number is now taken by another user'});
    db.prepare('UPDATE users SET phone=?,country_code=COALESCE(?,country_code),updated_at=unixepoch() WHERE id=?').run(pr.new_value,pr.country_code,pr.user_id);
  }
  db.prepare(`UPDATE profile_change_requests SET status='approved',decided_by=?,decided_at=unixepoch() WHERE id=?`).run(req.adminId,pr.id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(pr.user_id,`Your ${pr.field} has been updated`,`Your ${pr.field} was changed to ${pr.new_value} as requested.`,'success');
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,pr.user_id,'profile_request_approved');
  res.json({success:true});
});

// POST /:id/reject — turns the request down (optional admin note).
router.post('/:id/reject', authAdmin, (req,res)=>{
  const db=getDb();
  const pr=db.prepare('SELECT * FROM profile_change_requests WHERE id=?').get(req.params.id);
  if(!pr) return res.status(404).json({error:'Request not found'});
  if(pr.status!=='pending') return res.status(400).json({error:'This request is already closed'});
  const note=(req.body&&req.body.admin_note)||null;
  db.prepare(`UPDATE profile_change_requests SET status='rejected',admin_note=?,decided_by=?,decided_at=unixepoch() WHERE id=?`).run(note,req.adminId,pr.id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(pr.user_id,`Your ${pr.field} change request was rejected`,`Your request to change ${pr.field} to ${pr.new_value} was rejected.`+(note?` Reason: ${note}`:''),'warning');
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,pr.user_id,'profile_request_rejected');
  res.json({success:true});
});

module.exports = router;
