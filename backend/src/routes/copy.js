// routes/copy.js — copy trading: browse traders and manage copies.
// Public: GET /traders (visible traders) and /traders/:id. Logged-in user:
// GET /my-copies (active copies with trader name/avatar/flag), /history
// (all copies), /daily-pnl-log, and POST /start, /increase, /decrease,
// /stop (all run through copyService).
// Rules: copy moves money from Main Balance to Copy Invested; profit is
// earned only on Copy Invested. Showcase accounts (is_showcase=1) copy
// against their DISPLAY balances instead of the real balances table.
// All write routes refuse impersonation sessions (admin 'Login as User').
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { startCopy, increaseCopy, decreaseCopy, stopCopy } = require('../services/copyService');

// GET /traders — public list of visible traders, most followers first.
router.get('/traders', (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM traders WHERE is_hidden=0 ORDER BY followers DESC').all());
});

// GET /traders/:id — public detail for one visible trader (404 if
// hidden or missing).
router.get('/traders/:id', (req,res)=>{
  const t=getDb().prepare('SELECT * FROM traders WHERE id=? AND is_hidden=0').get(req.params.id);
  if(!t) return res.status(404).json({error:'Trader not found'});
  res.json(t);
});

// GET /my-copies — the user's active copies, joined with trader name,
// avatar, flag, risk level and strategy (what the frontend renders).
router.get('/my-copies', authImpersonation, (req,res)=>{
  const db=getDb();
  const copies=db.prepare(`SELECT c.*,t.name as trader_name,t.username as trader_username,t.avatar as trader_avatar,t.flag_emoji,t.verified,t.risk_level,t.strategy FROM copies c JOIN traders t ON c.trader_id=t.id WHERE c.user_id=? AND c.status='active' ORDER BY c.created_at DESC`).all(req.userId);
  res.json(copies);
});

// GET /history — all of the user's copies (active and stopped).
router.get('/history', authImpersonation, (req,res)=>{
  const db=getDb();
  res.json(db.prepare('SELECT c.*,t.name as trader_name,t.username as trader_username FROM copies c JOIN traders t ON c.trader_id=t.id WHERE c.user_id=? ORDER BY c.created_at DESC').all(req.userId));
});

// POST /start — starts copying a trader. Body: trader_id, amount
// (dollars). Creates the copy row and moves the amount Main -> Copy
// Invested. Fails when the Main Balance (or the display balance for a
// showcase account) is too low or below the trader minimum.
router.post('/start', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {trader_id,amount}=req.body;
    if(!trader_id||!amount) return res.status(400).json({error:'trader_id and amount required'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    const copyId=startCopy(req.userId,parseInt(trader_id),amountCents);
    res.json({success:true,copy_id:copyId,message:'Copy started successfully'});
  }catch(e){res.status(400).json({error:e.message});}
});

// POST /increase — adds money to an active copy (Main -> Copy Invested).
router.post('/increase', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {copy_id,amount}=req.body;
    if(!copy_id||!amount) return res.status(400).json({error:'copy_id and amount required'});
    increaseCopy(req.userId,parseInt(copy_id),Math.round(parseFloat(amount)*100));
    res.json({success:true,message:'Copy increased'});
  }catch(e){res.status(400).json({error:e.message});}
});

// POST /decrease — takes money out of an active copy (Copy Invested
// -> Main). Cannot decrease below zero.
router.post('/decrease', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {copy_id,amount}=req.body;
    if(!copy_id||!amount) return res.status(400).json({error:'copy_id and amount required'});
    decreaseCopy(req.userId,parseInt(copy_id),Math.round(parseFloat(amount)*100));
    res.json({success:true,message:'Copy decreased'});
  }catch(e){res.status(400).json({error:e.message});}
});

// POST /stop — stops a copy: principal + earned profit return to Main
// Balance and the copy is marked stopped.
router.post('/stop', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {copy_id}=req.body;
    if(!copy_id) return res.status(400).json({error:'copy_id required'});
    const result=stopCopy(req.userId,parseInt(copy_id));
    res.json({success:true,message:'Copy stopped. Funds returned to Main Balance.',...result});
  }catch(e){res.status(400).json({error:e.message});}
});

// GET /daily-pnl-log — the user's daily profit log rows (newest first,
// max 100), with trader names.
router.get('/daily-pnl-log', authImpersonation, (req,res)=>{
  const db=getDb();
  res.json(db.prepare('SELECT p.*,t.name as trader_name FROM daily_pnl_log p JOIN traders t ON p.trader_id=t.id WHERE p.user_id=? ORDER BY p.applied_at DESC LIMIT 100').all(req.userId));
});

module.exports = router;
