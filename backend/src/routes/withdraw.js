// routes/withdraw.js — user withdrawals (USDT BEP20, manual admin approval).
// GET /info returns the lock/fee status: whether Main is still inside the
// 3-month lock, the early (15%) or regular fee percent, the profit minimum
// ($10) and the unlock date. POST /main withdraws from Main Balance,
// POST /profit withdraws from Profit Balance. GET /history lists the
// user's withdrawal requests.
// Rules: withdraw from Main only; the wallet address must start with 0x.
// The amount is deducted immediately at request time and refunded if the
// admin rejects. Profit withdrawals have no fee but need a $10 minimum.
// The admin approves/pays from the admin panel (see withdrawService).
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { requestMainWithdraw, requestProfitWithdraw } = require('../services/withdrawService');
const { getBalance, getMoneySettings, calcMainWithdrawFee, getSetting } = require('../services/moneyHelpers');
const { tryAutoWithdraw, isBep20Address } = require('../services/autoPayments');

// GET /api/withdraw/info — get withdraw info for the user
// GET /info — lock and fee status for the withdraw form. A month is
// approximated as 30.44 days when comparing first_deposit_at to now.
router.get('/info', authImpersonation, (req,res)=>{
  const bal=getBalance(req.userId);
  const s=getMoneySettings();
  const isLocked=!bal.first_deposit_at||((Date.now()/1000-bal.first_deposit_at)/(30.44*24*3600)<s.lockMonths);
  const db=getDb();
  const firstDep=bal.first_deposit_at;
  let unlockDate=null, monthsRemaining=null;
  if(firstDep){
    const unlockTs=firstDep+(s.lockMonths*30.44*24*3600);
    unlockDate=new Date(unlockTs*1000).toISOString().split('T')[0];
    const now=Date.now()/1000;
    const elapsed=(now-firstDep)/(30.44*24*3600);
    monthsRemaining=Math.max(0,Math.ceil(s.lockMonths-elapsed));
  }
  res.json({main_cents:bal.main_cents,profit_cents:bal.profit_cents,
    early_fee_percent:s.earlyFeeBp/100,regular_fee_percent:s.regularFeeBp/100,is_locked:isLocked,
    profit_min_cents:s.profitMinCents,unlock_date:unlockDate,
    months_remaining:monthsRemaining,first_deposit_at:firstDep});
});

// POST /api/withdraw/main
// POST /main — requests a Main Balance withdrawal. Body: amount
// (dollars), wallet_address (must start with 0x). Deducts the amount
// now; the admin approves or rejects it later (reject refunds it).
router.post('/main', authImpersonation, async (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {amount,wallet_address}=req.body;
    if(!amount||!wallet_address) return res.status(400).json({error:'Amount and wallet address required'});
    if(!isBep20Address(wallet_address)) return res.status(400).json({error:'Enter a valid USDT BEP20 address (0x followed by 40 hex characters)'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    // Global switch (Money Settings) + per-user block (User Access Controls).
    if(getSetting('withdraw_enabled','1')==='0') return res.status(403).json({error:'Withdrawals are currently disabled'});
    if(getDb().prepare("SELECT id FROM user_blocks WHERE user_id=? AND kind='withdraw'").get(req.userId)) return res.status(403).json({error:'Withdrawals are disabled for your account'});
    const result=requestMainWithdraw(req.userId,amountCents,wallet_address);
    // Auto withdrawal (v122): send via Binance when the master toggle is
    // ON and every check passes (limits, confirmed address, hot wallet).
    // Anything else leaves the request pending for manual review.
    let auto = { auto: false, reason: 'auto-off' };
    try { auto = await tryAutoWithdraw(result.wId, getDb()); } catch (e) { console.error('[withdraw] auto send threw:', e?.message || e); }
    if (auto && auto.auto) {
      return res.json({success:true,auto_sent:true,message:'Withdrawal sent automatically. Binance withdrawal ID: ' + auto.txId,...result});
    }
    res.json({success:true,auto_sent:false,message:'Withdrawal submitted. Awaiting approval.',...result});
  }catch(e){res.status(400).json({error:e.message});}
});

// POST /api/withdraw/profit
// POST /profit — requests a Profit Balance withdrawal. Same rules as
// /main, but no fee and a $10 minimum (see withdrawService).
router.post('/profit', authImpersonation, async (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {amount,wallet_address}=req.body;
    if(!amount||!wallet_address) return res.status(400).json({error:'Amount and wallet address required'});
    if(!isBep20Address(wallet_address)) return res.status(400).json({error:'Enter a valid USDT BEP20 address (0x followed by 40 hex characters)'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    // Global switch (Money Settings) + per-user block (User Access Controls).
    if(getSetting('withdraw_enabled','1')==='0') return res.status(403).json({error:'Withdrawals are currently disabled'});
    if(getDb().prepare("SELECT id FROM user_blocks WHERE user_id=? AND kind='withdraw'").get(req.userId)) return res.status(403).json({error:'Withdrawals are disabled for your account'});
    const result=requestProfitWithdraw(req.userId,amountCents,wallet_address);
    // Auto withdrawal (v122): same as Main — send via Binance when the
    // master toggle is ON and every check passes.
    let auto = { auto: false, reason: 'auto-off' };
    try { auto = await tryAutoWithdraw(result.wId, getDb()); } catch (e) { console.error('[withdraw] auto send threw:', e?.message || e); }
    if (auto && auto.auto) {
      return res.json({success:true,auto_sent:true,message:'Profit withdrawal sent automatically. Binance withdrawal ID: ' + auto.txId,...result});
    }
    res.json({success:true,auto_sent:false,message:'Profit withdrawal submitted. Awaiting approval.',...result});
  }catch(e){res.status(400).json({error:e.message});}
});

// GET /api/withdraw/history
// GET /history — the user's withdrawal requests, newest first.
router.get('/history', authImpersonation, (req,res)=>{
  const db=getDb();
  res.json(db.prepare('SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC').all(req.userId));
});

module.exports = router;
