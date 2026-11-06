// routes/admin/kyc.js — admin review of KYC submissions.
// GET / lists all submissions (newest first) with user name/username.
// GET /:id returns one submission with its uploaded documents.
// POST /:id/review approves or rejects a submission.
// Rules: approving sets the user's kyc_status to 'approved' and clears
// any per-user request; rejecting returns them to 'not_submitted'.
// The KYC master switch and per-user requests live in settings.js.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

// GET / — all KYC submissions with user name/username, newest first.
router.get('/', authAdmin, (req,res)=>{
  const db=getDb(); const {status,limit=50,offset=0}=req.query;
  let q='SELECT k.*,u.full_name,u.username,u.email FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE 1=1';
  const p=[];
  if(status){q+=` AND k.status='${status}'`;}
  q+=' ORDER BY k.submitted_at DESC LIMIT ? OFFSET ?';p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// GET /:id — one submission with user info and its documents.
router.get('/:id', authAdmin, (req,res)=>{
  const db=getDb();
  const kyc=db.prepare('SELECT k.*,u.full_name,u.username,u.email,u.phone FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE k.id=?').get(req.params.id);
  if(!kyc) return res.status(404).json({error:'KYC submission not found'});
  res.json(kyc);
});

// POST /:id/review — approve or reject a submission. Body: action
// 'approve'|'reject', optional admin note. Approving sets the user
// approved (and clears any per-user request); rejecting sets them back
// to 'not_submitted'.
router.post('/:id/review', authAdmin, (req,res)=>{
  const {action,note}=req.body;
  if(!['approve','reject'].includes(action)) return res.status(400).json({error:'Action must be approve or reject'});
  const db=getDb();
  const kyc=db.prepare(`SELECT * FROM kyc_submissions WHERE id=? AND status='pending'`).get(req.params.id);
  if(!kyc) return res.status(400).json({error:'KYC not found or already reviewed'});
  const newStatus=action==='approve'?'approved':'rejected';
  db.prepare('UPDATE kyc_submissions SET status=?,admin_note=?,reviewed_by=?,reviewed_at=unixepoch(),updated_at=unixepoch() WHERE id=?').run(newStatus,note||null,req.adminId,kyc.id);
  db.prepare('UPDATE users SET kyc_status=? WHERE id=?').run(newStatus,kyc.user_id);
  if(action==='approve')db.prepare('UPDATE users SET kyc_requested=0 WHERE id=?').run(kyc.user_id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(kyc.user_id,`KYC ${newStatus}`,`Your KYC verification has been ${newStatus}.`+(note?` Note: ${note}`:''),action==='approve'?'success':'warning');
  res.json({success:true});
});

module.exports = router;
