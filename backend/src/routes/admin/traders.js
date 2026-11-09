// routes/admin/traders.js — admin management of copy traders.
// GET / lists all traders (including hidden ones). POST / creates one
// (avatar upload, win rate, flag, ROI, risk level) and auto-generates
// their per-trader profit plan from the current cycle day. PUT /:id
// edits one. PUT /:id/toggle-hidden hides or shows a trader (showing
// one regenerates a fresh plan from the current day). DELETE /:id
// removes a trader: every active copy is settled (principal to Main,
// profit stays in Profit Balance), their future plan rows are deleted,
// past History stays, and the trader is hidden (never hard-deleted —
// copies and Trade History reference them). GET /copies/active lists
// all active copies; POST /copies/:id/stop force-stops one copy.
// Rule: traders are ranked by win rate on the user side; the Top 5 tier
// frames are assigned automatically by rank, never by the admin.
const router = require('express').Router();
const { getDb, getShowcaseDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { stopCopy, settleTraderCopies } = require('../../services/copyService');
const { generateTraderPlan, currentCycleDay } = require('../../services/profitService');

// The current year/month in Dhaka time (the profit cycle's timezone).
function dhakaYM() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
  const get = t => p.find(x => x.type === t).value;
  return { year: parseInt(get('year'), 10), month: parseInt(get('month'), 10) };
}
const multer = require('multer');
const path = require('path');
const { getUploadsDir, ensureUploadsDir } = require('../../services/uploads');
ensureUploadsDir();
const upload = multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,getUploadsDir()),filename:(req,file,cb)=>cb(null,`trader_${Date.now()}_${file.originalname}`)}),limits:{fileSize:5*1024*1024}});

// GET / — all traders (including hidden), newest first.
router.get('/', authAdmin, (req,res)=>res.json(getDb().prepare('SELECT * FROM traders ORDER BY created_at DESC').all()));

// POST / — creates a trader (name, username, avatar upload, flag,
// ROI, win rate, risk level, minimum copy amount).
router.post('/', authAdmin, upload.single('avatar'), (req,res)=>{
  const {name,username,flag_emoji,verified,roi_percent,win_rate,drawdown,risk_level,min_copy,followers,strategy}=req.body;
  if(!name||!username) return res.status(400).json({error:'Name and username required'});
  const db=getDb();
  if(db.prepare('SELECT id FROM traders WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken. Use another username.'});
  const avatar=req.file?`/uploads/${req.file.filename}`:null;
  const id=db.prepare('INSERT INTO traders (name,username,avatar,flag_emoji,verified,roi_percent,win_rate,drawdown,risk_level,min_copy_cents,followers,strategy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(name,username,avatar,flag_emoji||'🇬🇧',(verified==='1'||verified==='true'||verified===1)?1:0,parseFloat(roi_percent||10),parseFloat(win_rate||75),parseFloat(drawdown||5),risk_level||'Medium',Math.round(parseFloat(min_copy||10)*100),parseInt(followers||0),strategy||null).lastInsertRowid;
  // A new trader joins the month's plan from the current cycle day and
  // earns only the remaining percent (a full 10% from the next month).
  // A plan failure never blocks the trader creation.
  try {
    const { year, month } = dhakaYM();
    generateTraderPlan(year, month, id, currentCycleDay(year, month) || 1);
  } catch (e) { console.error('[traders] plan generation failed for trader', id, e.message); }
  res.json({success:true,id});
});

// PUT /:id — edits a trader (all fields optional; avatar upload
// replaces the picture).
router.put('/:id', authAdmin, upload.single('avatar'), (req,res)=>{
  const {name,username,flag_emoji,verified,roi_percent,win_rate,drawdown,risk_level,min_copy,followers,strategy}=req.body;
  const db=getDb(); const t=db.prepare('SELECT * FROM traders WHERE id=?').get(req.params.id);
  if(!t) return res.status(404).json({error:'Trader not found'});
  if(username&&username!==t.username&&db.prepare('SELECT id FROM traders WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken. Use another username.'});
  const avatar=req.file?`/uploads/${req.file.filename}`:t.avatar;
  const ver=verified===undefined?t.verified:((verified==='1'||verified==='true'||verified===1)?1:0);
  db.prepare('UPDATE traders SET name=?,username=?,avatar=?,flag_emoji=?,verified=?,roi_percent=?,win_rate=?,drawdown=?,risk_level=?,min_copy_cents=?,followers=?,strategy=? WHERE id=?')
    .run(name||t.name,username||t.username,avatar,flag_emoji||t.flag_emoji,ver,roi_percent!==undefined&&roi_percent!==''?parseFloat(roi_percent):t.roi_percent,win_rate!==undefined&&win_rate!==''?parseFloat(win_rate):t.win_rate,drawdown!==undefined&&drawdown!==''?parseFloat(drawdown):t.drawdown,risk_level||t.risk_level,min_copy?Math.round(parseFloat(min_copy)*100):t.min_copy_cents,followers!==undefined&&followers!==''?parseInt(followers):t.followers,strategy!==undefined?strategy:t.strategy,req.params.id);
  res.json({success:true});
});

// PUT /:id/toggle-hidden — hides a trader from users (or shows them
// again). Hidden traders keep their existing copies.
router.put('/:id/toggle-hidden', authAdmin, (req,res)=>{
  const db=getDb(); const t=db.prepare('SELECT * FROM traders WHERE id=?').get(req.params.id);
  if(!t) return res.status(404).json({error:'Trader not found'});
  const showing = !!t.is_hidden;
  db.prepare('UPDATE traders SET is_hidden=? WHERE id=?').run(t.is_hidden?0:1,t.id);
  // Showing a trader again gives them a brand-new plan from the current
  // cycle day (a re-add never reuses the old plan's rates).
  if (showing) {
    try {
      const { year, month } = dhakaYM();
      generateTraderPlan(year, month, t.id, currentCycleDay(year, month) || 1);
    } catch (e) { console.error('[traders] plan regeneration failed for trader', t.id, e.message); }
  }
  res.json({success:true});
});

// DELETE /:id — removes a trader. Every active copy (real + showcase)
// is settled first: principal returns to Main Balance, profit stays in
// Profit Balance (Total PnL). Their future plan rows are deleted, past
// History stays, and the trader is hidden — never hard-deleted, because
// copies and Trade History reference them.
router.delete('/:id', authAdmin, (req,res)=>{
  try{
    const db=getDb();
    const trader=db.prepare('SELECT * FROM traders WHERE id=?').get(req.params.id);
    if(!trader) return res.status(404).json({error:'Trader not found'});
    const main = settleTraderCopies(db, trader.id, trader.name);
    const sc = settleTraderCopies(getShowcaseDb(), trader.id, trader.name);
    db.prepare('DELETE FROM trader_profit_schedule WHERE trader_id=? AND applied=0').run(trader.id);
    db.prepare('UPDATE traders SET is_hidden=1 WHERE id=?').run(trader.id);
    db.prepare('INSERT INTO audit_log (admin_id,action,entity,after_value) VALUES (?,?,?,?)').run(req.adminId,'remove_trader',`trader${trader.id}/${trader.name}`,`settled=${main.settled+sc.settled} principal_cents=${main.totalPrincipal+sc.totalPrincipal}`);
    res.json({success:true,settled:main.settled+sc.settled,totalPrincipalCents:main.totalPrincipal+sc.totalPrincipal});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /copies/active — every active copy with user and trader names.
router.get('/copies/active', authAdmin, (req,res)=>{
  res.json(getDb().prepare(`SELECT c.*,u.full_name,u.username,t.name as trader_name FROM copies c JOIN users u ON c.user_id=u.id JOIN traders t ON c.trader_id=t.id WHERE c.status='active' AND u.is_showcase=0 ORDER BY c.created_at DESC`).all());
});

// POST /copies/:id/stop — force-stops one copy (principal returns to
// the user's Main Balance; profit stays in Profit Balance).
router.post('/copies/:id/stop', authAdmin, (req,res)=>{
  try{
    const db=getDb();
    const copy=db.prepare(`SELECT * FROM copies WHERE id=? AND status='active'`).get(req.params.id);
    if(!copy) return res.status(404).json({error:'Active copy not found'});
    const result=stopCopy(copy.user_id,copy.id);
    db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,copy.user_id,`admin_stop_copy:${copy.id}`);
    res.json({success:true,...result});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
