// routes/admin/finance.js — admin money screens: deposits, withdrawals,
// transactions ledger and referrals.
// Deposits: list / approve (credits Main Balance via moneyService) /
// reject. Withdrawals: list / process (approve or reject, via
// withdrawService). GET /transactions is the full ledger; GET /referrals
// lists every referral commission.
// Rule: the TRANSACTIONS ledger and REFERRALS list are real users only
// (is_showcase=0) — showcase money never appears there. But the Deposits
// and Withdrawals APPROVAL QUEUES merge both databases: showcase requests
// reach the admin and can be approved/rejected (their money moves in the
// showcase DB). Merged rows carry is_showcase:1 so the admin UI can show
// a "Showcase" badge; the approve/reject/process endpoints take an
// is_showcase flag in the body to pick the right database.
const router = require('express').Router();
const { getDb, getMainDb, getShowcaseDb, runWithDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { applyDeposit } = require('../../services/moneyService');
const { processWithdrawal } = require('../../services/withdrawService');
const { tryAutoWithdraw, confirmAddress, getAutoSettings } = require('../../services/autoPayments');
const { markAdminNotifRead } = require('../../services/moneyHelpers');

// GET /deposits — all deposit requests with user name/username, newest
// first. Real deposits (main DB) MERGED with showcase deposits
// (showcase DB, flagged is_showcase:1) so the admin can approve both.
router.get('/deposits', authAdmin, (req,res)=>{
  const {status,limit=50,offset=0}=req.query;
  const lim=parseInt(limit), off=parseInt(offset);
  let q=`SELECT d.*,u.full_name,u.username,u.email,0 AS is_showcase FROM deposits d JOIN users u ON d.user_id=u.id WHERE u.is_showcase=0`;
  if(status){q+=` AND d.status='${status}'`;}
  q+=` ORDER BY d.created_at DESC`;
  const rows=getMainDb().prepare(q).all();
  let sq=`SELECT d.*,u.full_name,u.username,u.email,1 AS is_showcase FROM deposits d JOIN users u ON d.user_id=u.id`;
  if(status){sq+=` WHERE d.status='${status}'`;}
  sq+=` ORDER BY d.created_at DESC`;
  const scRows=getShowcaseDb().prepare(sq).all();
  const merged=[...rows,...scRows].sort((a,b)=>b.created_at-a.created_at);
  res.json(merged.slice(off, off+lim));
});

// POST /deposits/:id/approve — approves a pending deposit: credits the
// user's Main Balance via moneyService.applyDeposit (also pays the
// referrer on a first deposit).
router.post('/deposits/:id/approve', authAdmin, (req,res)=>{
  try{
    const isSc = req.body && req.body.is_showcase === true;
    const db = isSc ? getShowcaseDb() : getMainDb();
    const dep=db.prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
    if(!dep||dep.status!=='pending') return res.status(400).json({error:'Deposit not found or already processed'});
    if (isSc) runWithDb(db, ()=>applyDeposit(dep.user_id,dep.id,dep.amount_cents,req.adminId));
    else applyDeposit(dep.user_id,dep.id,dep.amount_cents,req.adminId);
    // Work done — clear this deposit's admin notification (the request
    // row AND the "Deposit approved" row applyDeposit just made) so the
    // bell badge goes away without "Mark All Read". Admin notifications
    // always live in the main DB.
    markAdminNotifRead(getMainDb(), isSc ? 'showcase_deposit' : 'deposit', dep.id);
    res.json({success:true,message:'Deposit approved'});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /deposits/:id/reject — rejects a pending deposit: marks the
// deposit and its pending History row rejected. No money moves.
router.post('/deposits/:id/reject', authAdmin, (req,res)=>{
  try{
    const {note, is_showcase: isScFlag}=req.body; const isSc = isScFlag === true;
    const db = isSc ? getShowcaseDb() : getMainDb();
    const dep=db.prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
    if(!dep||dep.status!=='pending') return res.status(400).json({error:'Not found or processed'});
    db.prepare(`UPDATE deposits SET status='rejected',admin_note=?,approved_by=?,approved_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(note||null,req.adminId,dep.id);
    db.prepare(`UPDATE transactions SET status='rejected' WHERE reference=?`).run(`DEP-${dep.id}`);
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(dep.user_id,'Deposit rejected',`Your deposit of $${(dep.amount_cents/100).toFixed(2)} was rejected.`+(note?` Reason: ${note}`:''),'warning');
    markAdminNotifRead(getMainDb(), isSc ? 'showcase_deposit' : 'deposit', dep.id);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /withdrawals — all withdrawal requests with user name/username
// and wallet address, newest first. Real (main DB) MERGED with showcase
// (showcase DB, flagged is_showcase:1) so the admin can approve both.
router.get('/withdrawals', authAdmin, (req,res)=>{
  const {status,type,limit=50,offset=0}=req.query;
  const lim=parseInt(limit), off=parseInt(offset);
  let q=`SELECT w.*,u.full_name,u.username,u.email,0 AS is_showcase FROM withdrawals w JOIN users u ON w.user_id=u.id WHERE u.is_showcase=0`;
  if(status){q+=` AND w.status='${status}'`;}
  if(type){q+=` AND w.type='${type}'`;}
  q+=` ORDER BY w.created_at DESC`;
  const rows=getMainDb().prepare(q).all();
  let sq=`SELECT w.*,u.full_name,u.username,u.email,1 AS is_showcase FROM withdrawals w JOIN users u ON w.user_id=u.id`;
  const scWhere=[];
  if(status){scWhere.push(`w.status='${status}'`);}
  if(type){scWhere.push(`w.type='${type}'`);}
  if(scWhere.length) sq+=` WHERE `+scWhere.join(' AND ');
  sq+=` ORDER BY w.created_at DESC`;
  const scRows=getShowcaseDb().prepare(sq).all();
  const merged=[...rows,...scRows].sort((a,b)=>b.created_at-a.created_at);
  res.json(merged.slice(off, off+lim));
});

// POST /withdrawals/:id/process — approves or rejects a pending
// withdrawal (body: action 'approve'|'reject') via
// withdrawService.processWithdrawal.
// Approve SENDS the money via Binance (v128.16 — before this, Approve
// only marked the row paid and the admin had to send from Binance
// himself, so users were told 'paid' with nothing sent). On approve
// for a real user: the address is confirmed (the admin verified it),
// then tryAutoWithdraw attempts the Binance send. If it succeeds the
// row is paid with the real Binance tx id. If Binance is not configured
// (no withdraw key) it falls back to mark-paid (admin sends manually).
// If the send fails for any other reason the withdrawal STAYS pending
// and the error is returned — it is never marked paid without sending.
// Pass force:true to skip the Binance attempt and mark paid directly
// (the 'Mark Paid' button — use only after sending manually).
router.post('/withdrawals/:id/process', authAdmin, async (req,res)=>{
  try{
    const {action,note,is_showcase: isScFlag,force: forceFlag}=req.body;
    if(!['approve','reject'].includes(action)) return res.status(400).json({error:'Action must be approve or reject'});
    const isSc = isScFlag === true;
    const force = forceFlag === true;
    const id = parseInt(req.params.id);
    if(action==='approve' && !isSc && !force){
      const db = getMainDb();
      const wd = db.prepare('SELECT * FROM withdrawals WHERE id=? AND status=\'pending\'').get(id);
      if(!wd) return res.status(400).json({error:'Withdrawal not found or already processed'});
      const cfg = getAutoSettings();
      if(cfg.withdrawKey && cfg.withdrawSecret){
        // Admin verified this address by approving — confirm it so the
        // new-address check passes and future withdrawals auto-send.
        try{ confirmAddress(db, wd.user_id, wd.wallet_address); }catch(_){}
        const sent = await tryAutoWithdraw(id, db, {manual:true});
        if(sent.auto){
          markAdminNotifRead(getMainDb(), 'withdrawal', id);
          return res.json({success:true,message:'Withdrawal approved and sent via Binance',tx_hash:sent.txId});
        }
        return res.status(400).json({error:`Binance send failed (${sent.reason}${sent.message?': '+sent.message:''}). Withdrawal is still pending — send $${(wd.net_cents/100).toFixed(2)} USDT (BEP20) manually from Binance to ${wd.wallet_address}, then use Mark Paid.`});
      }
      // No Binance withdraw key — fall through to mark-paid (admin sends manually).
    }
    if (isSc) runWithDb(getShowcaseDb(), ()=>processWithdrawal(id,action,req.adminId,note));
    else processWithdrawal(id,action,req.adminId,note);
    markAdminNotifRead(getMainDb(), isSc ? 'showcase_withdrawal' : 'withdrawal', id);
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

// GET /payment-attempts — failed auto-verifies waiting for admin
// review ("Needs review" queue). Each row carries the reason and the
// real on-chain detail (from / to / amount) so the admin can check the
// payment and approve or reject the matching pending deposit.
router.get('/payment-attempts', authAdmin, (req,res)=>{
  const {status='pending',limit=50,offset=0}=req.query;
  const db=getMainDb();
  const rows=db.prepare(`SELECT a.*,u.full_name,u.username,u.email FROM payment_attempts a JOIN users u ON a.user_id=u.id WHERE a.status=? ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(status,parseInt(limit),parseInt(offset));
  const count=db.prepare(`SELECT COUNT(*) AS c FROM payment_attempts WHERE status=?`).get(status);
  res.json({attempts:rows,total:count?count.c:0});
});

// POST /payment-attempts/:id/review — mark an attempt reviewed (the
// admin has looked at it; the matching deposit is approved or rejected
// from the Deposits queue as usual).
router.post('/payment-attempts/:id/review', authAdmin, (req,res)=>{
  try{
    const db=getMainDb();
    const a=db.prepare('SELECT * FROM payment_attempts WHERE id=?').get(req.params.id);
    if(!a||a.status!=='pending') return res.status(400).json({error:'Attempt not found or already reviewed'});
    db.prepare(`UPDATE payment_attempts SET status='reviewed',reviewed_at=unixepoch() WHERE id=?`).run(req.params.id);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
