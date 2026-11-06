// routes/deposit.js — user deposits via Binance Pay (manual admin approval).
// POST / submits a deposit: the user pays USDT in the Binance app and sends
// the Transaction ID + amount. Creates a deposits row (status 'pending'),
// a pending transactions row so the deposit shows in History right away,
// and an admin notification. The money is credited to Main Balance only
// when an admin approves it (see moneyService.applyDeposit).
// GET /history lists the user's deposits; GET /wallet returns the admin's
// Binance Pay address + QR code (both come from site settings, never from
// a static file).
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { getSetting } = require('../services/moneyHelpers');

// POST / — submit a deposit. Body: txid, amount (dollars). Side effects:
// deposits row (pending) + pending transactions row (reference DEP-<id>)
// + admin notification. Nothing is credited until an admin approves.
router.post('/', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {txid,amount}=req.body;
    if(!txid||!amount) return res.status(400).json({error:'Transaction ID and amount are required'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    const db=getDb();
    // Global switch (Money Settings) + per-user block (User Access Controls).
    if(getSetting('deposit_enabled','1')==='0') return res.status(403).json({error:'Deposits are currently disabled'});
    if(db.prepare("SELECT id FROM user_blocks WHERE user_id=? AND kind='deposit'").get(req.userId)) return res.status(403).json({error:'Deposits are disabled for your account'});
    const depId=db.prepare(`INSERT INTO deposits (user_id,amount_cents,txid,method,status) VALUES (?,?,?,'Binance Pay','pending')`)
      .run(req.userId,amountCents,txid).lastInsertRowid;
    // Pending row in History right away (same pattern as withdraws): the user
    // sees 'Deposit — Pending' until the admin approves or rejects it.
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,0,?,?,?,?,?,?)')
      .run(req.userId,'deposit',amountCents,amountCents,'in','pending',`DEP-${depId}`,'Deposit submitted — awaiting approval',`Main += $${(amountCents/100).toFixed(2)} (on approval)`);
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('deposit',`Deposit request — $${(amountCents/100).toFixed(2)}`,(()=>{const u=db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);return u?`${u.full_name} (@${u.username}) · TxID: ${txid}`:`TxID: ${txid}`;})(),depId,'deposit','deposits');
    res.json({success:true,message:'Deposit submitted. Awaiting approval.',id:depId});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /history — the user's deposits, newest first (all statuses).
router.get('/history', authImpersonation, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC').all(req.userId));
});

// GET /wallet — the Binance Pay address and QR the admin set in
// Site Settings (empty when the admin has not set them yet).
router.get('/wallet', (req,res)=>{
  const db=getDb();
  const addr=db.prepare(`SELECT value FROM site_settings WHERE key='binance_wallet_address'`).get();
  const qr=db.prepare(`SELECT value FROM site_settings WHERE key='binance_wallet_qr'`).get();
  res.json({address:addr?addr.value:null,qr:qr?qr.value:null});
});

module.exports = router;
