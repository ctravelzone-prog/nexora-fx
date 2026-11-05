// admin/finance.js — deposits, withdrawals, transactions, referrals
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { applyDeposit } = require('../../services/moneyService');
const { processWithdrawal } = require('../../services/withdrawService');

router.get('/deposits', authAdmin, (req,res)=>{
  const db=getDb(); const {status,limit=50,offset=0}=req.query;
  let q=`SELECT d.*,u.full_name,u.username,u.email FROM deposits d JOIN users u ON d.user_id=u.id WHERE u.is_showcase=0`;
  const p=[];
  if(status){q+=` AND d.status='${status}'`;}
  q+=` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

router.post('/deposits/:id/approve', authAdmin, (req,res)=>{
  try{
    const dep=getDb().prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
    if(!dep||dep.status!=='pending') return res.status(400).json({error:'Deposit not found or already processed'});
    applyDeposit(dep.user_id,dep.id,dep.amount_cents,req.adminId);
    res.json({success:true,message:'Deposit approved'});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/deposits/:id/reject', authAdmin, (req,res)=>{
  try{
    const {note}=req.body; const db=getDb();
    const dep=db.prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
    if(!dep||dep.status!=='pending') return res.status(400).json({error:'Not found or processed'});
    db.prepare(`UPDATE deposits SET status='rejected',admin_note=?,approved_by=?,approved_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(note||null,req.adminId,dep.id);
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(dep.user_id,'Deposit rejected',`Your deposit of $${(dep.amount_cents/100).toFixed(2)} was rejected.`+(note?` Reason: ${note}`:''),'warning');
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

router.get('/withdrawals', authAdmin, (req,res)=>{
  const db=getDb(); const {status,type,limit=50,offset=0}=req.query;
  let q=`SELECT w.*,u.full_name,u.username,u.email FROM withdrawals w JOIN users u ON w.user_id=u.id WHERE u.is_showcase=0`;
  const p=[];
  if(status){q+=` AND w.status='${status}'`;}
  if(type){q+=` AND w.type='${type}'`;}
  q+=` ORDER BY w.created_at DESC LIMIT ? OFFSET ?`;p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

router.post('/withdrawals/:id/process', authAdmin, (req,res)=>{
  try{
    const {action,note}=req.body;
    if(!['approve','reject'].includes(action)) return res.status(400).json({error:'Action must be approve or reject'});
    processWithdrawal(parseInt(req.params.id),action,req.adminId,note);
    res.json({success:true,message:`Withdrawal ${action==='approve'?'approved':'rejected'}`});
  }catch(e){res.status(400).json({error:e.message});}
});

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

router.get('/referrals', authAdmin, (req,res)=>{
  const db=getDb();
  res.json(db.prepare(`SELECT r.*,ru.full_name as referrer_name,ru.username as referrer_username,rd.full_name as referred_name,rd.username as referred_username FROM referrals r JOIN users ru ON r.referrer_user_id=ru.id JOIN users rd ON r.referred_user_id=rd.id ORDER BY r.created_at DESC`).all());
});

module.exports = router;
