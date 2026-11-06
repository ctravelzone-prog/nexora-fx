// routes/admin/finance.js — admin money screens: deposits, withdrawals,
// transactions ledger and referrals.
// Deposits: list / approve (credits Main Balance via moneyService) /
// reject. Withdrawals: list / process (approve or reject, via
// withdrawService). GET /transactions is the full ledger; GET /referrals
// lists every referral commission.
// Rule: every list here filters is_showcase=0 — showcase accounts never
// appear in admin finance.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { applyDeposit } = require('../../services/moneyService');
const { processWithdrawal } = require('../../services/withdrawService');

// GET /deposits — all deposit requests with user name/username, newest
// first. Showcase deposits are excluded (is_showcase=0).
router.get('/deposits', authAdmin, (req,res)=>{
  const db=getDb(); const {status,limit=50,offset=0}=req.query;
  let q=`SELECT d.*,u.full_name,u.username,u.email FROM deposits d JOIN users u ON d.user_id=u.id WHERE u.is_showcase=0`;
  const p=[];
  if(status){q+=` AND d.status='${status}'`;}
  q+=` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// POST /deposits/:id/approve — approves a pending deposit: credits the
// user's Main Balance via moneyService.applyDeposit (also pays the
// referrer on a first deposit).
router.post('/deposits/:id/approve', authAdmin, (req,res)=>{
  try{
    const dep=getDb().prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
    if(!dep||dep.status!=='pending') return res.status(400).json({error:'Deposit not found or already processed'});
    applyDeposit(dep.user_id,dep.id,dep.amount_cents,req.adminId);
    res.json({success:true,message:'Deposit approved'});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /deposits/:id/reject — rejects a pending deposit: marks the
// deposit and its pending History row rejected. No money moves.
router.post('/deposits/:id/reject', authAdmin, (req,res)=>{
  try{
    const {note}=req.body; const db=getDb();
    const dep=db.prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
    if(!dep||dep.status!=='pending') return res.status(400).json({error:'Not found or processed'});
    db.prepare(`UPDATE deposits SET status='rejected',admin_note=?,approved_by=?,approved_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(note||null,req.adminId,dep.id);
    db.prepare(`UPDATE transactions SET status='rejected' WHERE reference=?`).run(`DEP-${dep.id}`);
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(dep.user_id,'Deposit rejected',`Your deposit of $${(dep.amount_cents/100).toFixed(2)} was rejected.`+(note?` Reason: ${note}`:''),'warning');
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /withdrawals — all withdrawal requests with user name/username
// and wallet address, newest first. Showcase withdrawals excluded.
router.get('/withdrawals', authAdmin, (req,res)=>{
  const db=getDb(); const {status,type,limit=50,offset=0}=req.query;
  let q=`SELECT w.*,u.full_name,u.username,u.email FROM withdrawals w JOIN users u ON w.user_id=u.id WHERE u.is_showcase=0`;
  const p=[];
  if(status){q+=` AND w.status='${status}'`;}
  if(type){q+=` AND w.type='${type}'`;}
  q+=` ORDER BY w.created_at DESC LIMIT ? OFFSET ?`;p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// POST /withdrawals/:id/process — approves or rejects a pending
// withdrawal (body: action 'approve'|'reject') via
// withdrawService.processWithdrawal.
router.post('/withdrawals/:id/process', authAdmin, (req,res)=>{
  try{
    const {action,note}=req.body;
    if(!['approve','reject'].includes(action)) return res.status(400).json({error:'Action must be approve or reject'});
    processWithdrawal(parseInt(req.params.id),action,req.adminId,note);
    res.json({success:true,message:`Withdrawal ${action==='approve'?'approved':'rejected'}`});
  }catch(e){res.status(400).json({error:e.message});}
});

// GET /transactions — the full transaction ledger with user name/
// username, newest first. Showcase transactions are excluded.
router.get('/transactions', authAdmin, (req,res)=>{
  const db=getDb(); const {type,user_id,from,to,limit=100,offset=0}=req.query;
  let q=`SELECT t.*,u.full_name,u.username FROM transactions t JOIN users u ON t.user_id=u.id WHERE u.is_showcase=0`;
  const p=[];
  if(type){q+=` AND t.type='${type}'`;}
  if(user_id){q+=` AND t.user_id=?`;p.push(user_id);}
  if(from){q+=` AND t.created_at>=?`;p.push(parseInt(from));}
  if(to){q+=` AND t.created_at<=?`;p.push(parseInt(to));}
  q+=` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;p.push(parseInt(limit),parseInt(offset));
  const rows=db.prepare(q).all(...p);
  const totalIn=rows.filter(r=>r.direction==='in').reduce((a,r)=>a+r.amount_cents,0);
  const totalOut=rows.filter(r=>r.direction==='out').reduce((a,r)=>a+r.amount_cents,0);
  const totalFees=rows.reduce((a,r)=>a+r.fee_cents,0);
  res.json({transactions:rows,totals:{in:totalIn,out:totalOut,fees:totalFees,net:totalIn-totalOut-totalFees}});
});

// GET /referrals — every referral commission with referrer and
// referred user names, newest first.
router.get('/referrals', authAdmin, (req,res)=>{
  const db=getDb();
  res.json(db.prepare(`SELECT r.*,ru.full_name as referrer_name,ru.username as referrer_username,rd.full_name as referred_name,rd.username as referred_username FROM referrals r JOIN users ru ON r.referrer_user_id=ru.id JOIN users rd ON r.referred_user_id=rd.id ORDER BY r.created_at DESC`).all());
});

module.exports = router;
