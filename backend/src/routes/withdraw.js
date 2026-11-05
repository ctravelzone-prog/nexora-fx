// withdraw.js — withdraw routes
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { requestMainWithdraw, requestProfitWithdraw } = require('../services/withdrawService');
const { getBalance, getMoneySettings, calcMainWithdrawFee } = require('../services/moneyHelpers');

// GET /api/withdraw/info — get withdraw info for the user
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
router.post('/main', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {amount,wallet_address}=req.body;
    if(!amount||!wallet_address) return res.status(400).json({error:'Amount and wallet address required'});
    if(!wallet_address.startsWith('0x')) return res.status(400).json({error:'USDT BEP20 address must start with 0x'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    const result=requestMainWithdraw(req.userId,amountCents,wallet_address);
    res.json({success:true,message:'Withdrawal submitted. Awaiting admin approval.',...result});
  }catch(e){res.status(400).json({error:e.message});}
});

// POST /api/withdraw/profit
router.post('/profit', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {amount,wallet_address}=req.body;
    if(!amount||!wallet_address) return res.status(400).json({error:'Amount and wallet address required'});
    if(!wallet_address.startsWith('0x')) return res.status(400).json({error:'USDT BEP20 address must start with 0x'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    const result=requestProfitWithdraw(req.userId,amountCents,wallet_address);
    res.json({success:true,message:'Profit withdrawal submitted. Awaiting admin approval.',...result});
  }catch(e){res.status(400).json({error:e.message});}
});

// GET /api/withdraw/history
router.get('/history', authImpersonation, (req,res)=>{
  const db=getDb();
  res.json(db.prepare('SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC').all(req.userId));
});

module.exports = router;
