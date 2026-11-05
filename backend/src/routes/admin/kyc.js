// admin/kyc.js — KYC review (clean template literals)
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

router.get('/', authAdmin, (req,res)=>{
  const db=getDb(); const {status,limit=50,offset=0}=req.query;
  let q='SELECT k.*,u.full_name,u.username,u.email FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE 1=1';
  const p=[];
  if(status){q+=` AND k.status='${status}'`;}
  q+=' ORDER BY k.submitted_at DESC LIMIT ? OFFSET ?';p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

router.get('/:id', authAdmin, (req,res)=>{
  const db=getDb();
  const kyc=db.prepare('SELECT k.*,u.full_name,u.username,u.email,u.phone FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE k.id=?').get(req.params.id);
  if(!kyc) return res.status(404).json({error:'KYC submission not found'});
  res.json(kyc);
});

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
