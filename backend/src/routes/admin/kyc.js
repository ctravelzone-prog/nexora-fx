// routes/admin/kyc.js — admin review of KYC submissions.
// GET / lists all submissions (newest first) with user name/username.
// GET /:id returns one submission with its uploaded documents.
// POST /:id/review approves or rejects a submission.
// Rules: approving sets the user's kyc_status to 'approved' and clears
// any per-user request; rejecting returns them to 'not_submitted'.
// The KYC master switch and per-user requests live in settings.js.
// Showcase: submissions from showcase users live in the SHOWCASE DB
// (Siam 12 Nov 2026 — the admin never saw them). GET / MERGES main +
// showcase (flagged is_showcase:1, amber SHOWCASE badge in the UI),
// and GET /:id + POST /:id/review take is_showcase to pick the DB,
// exactly like deposits/withdrawals in finance.js. Admin notifications
// always live in the main DB (reference_type 'showcase_kyc' for
// showcase rows), so the review clears the bell from there.
const router = require('express').Router();
const { getMainDb, getShowcaseDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { markAdminNotifRead } = require('../../services/moneyHelpers');

// GET / — all KYC submissions with user name/username, newest first.
// Real (main DB) MERGED with showcase (showcase DB, flagged
// is_showcase:1) so the admin can review both.
router.get('/', authAdmin, (req,res)=>{
  const {status,limit=50,offset=0}=req.query;
  const lim=parseInt(limit), off=parseInt(offset);
  let q='SELECT k.*,u.full_name,u.username,u.email,0 AS is_showcase FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE 1=1';
  if(status){q+=` AND k.status='${status}'`;}
  q+=' ORDER BY k.submitted_at DESC';
  const rows=getMainDb().prepare(q).all();
  let sq='SELECT k.*,u.full_name,u.username,u.email,1 AS is_showcase FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE 1=1';
  if(status){sq+=` AND k.status='${status}'`;}
  sq+=' ORDER BY k.submitted_at DESC';
  const scRows=getShowcaseDb().prepare(sq).all();
  const merged=[...rows,...scRows].sort((a,b)=>b.submitted_at-a.submitted_at);
  res.json(merged.slice(off, off+lim));
});

// GET /:id — one submission with user info and its documents.
// is_showcase=1 reads the showcase DB (IDs can collide across DBs).
router.get('/:id', authAdmin, (req,res)=>{
  const isSc=req.query.is_showcase==='1'||req.query.is_showcase==='true';
  const db=isSc?getShowcaseDb():getMainDb();
  const kyc=db.prepare('SELECT k.*,u.full_name,u.username,u.email,u.phone,? AS is_showcase FROM kyc_submissions k JOIN users u ON k.user_id=u.id WHERE k.id=?').get(isSc?1:0,req.params.id);
  if(!kyc) return res.status(404).json({error:'KYC submission not found'});
  try{ kyc.form_data=kyc.form_data?JSON.parse(kyc.form_data):{}; }catch(_){ kyc.form_data={}; }
  res.json(kyc);
});

// POST /:id/review — approve or reject a submission. Body: action
// 'approve'|'reject', optional admin note, is_showcase for showcase
// rows. Approving sets the user approved (and clears any per-user
// request); rejecting sets them back to 'not_submitted'. The user
// notification goes into the DB the submission lives in (so a showcase
// user sees it); the admin bell is cleared from the main DB.
router.post('/:id/review', authAdmin, (req,res)=>{
  const {action,note}=req.body;
  if(!['approve','reject'].includes(action)) return res.status(400).json({error:'Action must be approve or reject'});
  const isSc=req.body&&req.body.is_showcase===true;
  const db=isSc?getShowcaseDb():getMainDb();
  const kyc=db.prepare(`SELECT * FROM kyc_submissions WHERE id=? AND status='pending'`).get(req.params.id);
  if(!kyc) return res.status(400).json({error:'KYC not found or already reviewed'});
  const newStatus=action==='approve'?'approved':'rejected';
  db.prepare('UPDATE kyc_submissions SET status=?,admin_note=?,reviewed_by=?,reviewed_at=unixepoch(),updated_at=unixepoch() WHERE id=?').run(newStatus,note||null,req.adminId,kyc.id);
  db.prepare('UPDATE users SET kyc_status=? WHERE id=?').run(newStatus,kyc.user_id);
  if(action==='approve')db.prepare('UPDATE users SET kyc_requested=0 WHERE id=?').run(kyc.user_id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(kyc.user_id,`KYC ${newStatus}`,`Your KYC verification has been ${newStatus}.`+(note?` Note: ${note}`:''),action==='approve'?'success':'warning');
  markAdminNotifRead(getMainDb(),isSc?'showcase_kyc':'kyc',kyc.id);
  res.json({success:true});
});

module.exports = router;
