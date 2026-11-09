// routes/admin/profit.js — profit schedule, manual apply and auto-profit.
// GET /schedule returns a month's 22-day schedule (generating it when the
// month has none). POST /schedule/generate regenerates it; PUT
// /schedule/:year/:month/:day edits one day's rate and rebalances the
// rest. POST /apply applies one day manually (optionally to one user
// only). GET /auto-status, POST /auto-run and POST /auto-toggle control
// the auto-profit scheduler. GET /user-data lists users with their
// copies and per-user profit targets.
// Rule: the 22-day target is a target, never a guarantee; Day 22 always
// balances the month to exactly the target.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');
const { generateSchedule, getSchedule, applyDailyPnl, rebalanceSchedule, formatDayRunTime } = require('../../services/profitService');
const { runAutoProfit, autoStatus, isAutoEnabled, setAutoEnabled } = require('../../services/autoProfit');

// GET /schedule — the month's 22-day schedule (generated first when
// the month has none yet). Query: ?year= &month=.
router.get('/schedule', authAdmin, (req,res)=>{
  const now=new Date(); const {year=now.getFullYear(),month=now.getMonth()+1}=req.query;
  const schedule=getSchedule(parseInt(year),parseInt(month));
  const total=schedule.reduce((a,d)=>a+d.rate_bp,0);
  res.json({schedule:schedule.map(s=>({...s,run_time:formatDayRunTime(s)})),total_bp:total,year:parseInt(year),month:parseInt(month)});
});

// POST /schedule/generate — Super Admin only. Regenerates the month's
// schedule (new random rates; applied days are lost, so it is used
// before a month starts).
router.post('/schedule/generate', authAdmin, superAdminOnly, (req,res)=>{
  const now=new Date(); const {year=now.getFullYear(),month=now.getMonth()+1}=req.body;
  const schedule=generateSchedule(parseInt(year),parseInt(month));
  getDb().prepare('INSERT INTO audit_log (admin_id,action,entity) VALUES (?,?,?)').run(req.adminId,'generate_profit_schedule',`${year}-${month}`);
  res.json({success:true,schedule});
});

// PUT /schedule/:year/:month/:day — Super Admin only. Edits one day's
// rate, then rebalances the remaining unapplied days so the month still
// lands exactly on the target.
router.put('/schedule/:year/:month/:day', authAdmin, superAdminOnly, (req,res)=>{
  try{
    const {rate_bp}=req.body;
    if(rate_bp===undefined) return res.status(400).json({error:'rate_bp required'});
    const {year,month,day}=req.params;
    rebalanceSchedule(parseInt(year),parseInt(month),parseInt(day),parseInt(rate_bp));
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity,after_value) VALUES (?,?,?,?)').run(req.adminId,'manual_schedule_edit',`day${day}/${month}/${year}`,`rate_bp=${rate_bp}`);
    res.json({success:true,schedule:getSchedule(parseInt(year),parseInt(month))});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /apply — applies one schedule day manually. Body: rate_bp,
// day_number, year, month, optional user_id (one user only; a
// single-user apply never touches showcase accounts).
router.post('/apply', authAdmin, (req,res)=>{
  try{
    const {rate_bp,day_number,year,month,user_id}=req.body;
    if(rate_bp===undefined||!day_number||!year||!month) return res.status(400).json({error:'rate_bp, day_number, year, month required'});
    // A full (not single-user) manual apply also pays showcase accounts
    // the same rate, trickled — applyDailyPnl handles showcase inside.
    const result=applyDailyPnl(parseInt(rate_bp),parseInt(year),parseInt(month),parseInt(day_number),user_id?parseInt(user_id):null);
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity) VALUES (?,?,?)').run(req.adminId,'apply_daily_pnl',`day${day_number}/${month}/${year}`);
    res.json({success:true,...result});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /auto-status — the auto-profit scheduler state (on/off, last
// applied date, whether today is a profit day).
router.get('/auto-status', authAdmin, (req,res)=>{
  res.json(autoStatus(new Date()));
});

// POST /auto-run — runs the auto-profit check once, right now (same
// Mon-Fri / day's shuffled time / once-per-day rules as the scheduler).
router.post('/auto-run', authAdmin, (req,res)=>{
  // Emergency/test trigger for the auto logic: bypasses only the day's time gate.
  // Weekend skip + once-per-day guard still apply, so it can never double-apply.
  try{ res.json({success:true,...runAutoProfit(new Date(),{force:true})}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// POST /auto-toggle — turns the auto-profit scheduler on or off.
router.post('/auto-toggle', authAdmin, (req,res)=>{
  const enabled = req.body && typeof req.body.enabled === 'boolean' ? req.body.enabled : !isAutoEnabled();
  setAutoEnabled(enabled);
  res.json({success:true, enabled});
});

// GET /user-data — users with their copies and per-user profit
// targets, for the Profit System page.
router.get('/user-data', authAdmin, (req,res)=>{
  const db=getDb();
  res.json(db.prepare(`SELECT u.id,u.full_name,u.username,b.total_deposited_cents,b.copy_cents,b.profit_cents,COALESCE((SELECT SUM(amount_cents) FROM daily_pnl_log WHERE user_id=u.id),0) as total_pnl_cents,(SELECT COUNT(*) FROM copies WHERE user_id=u.id AND status='active') as active_copies FROM users u JOIN balances b ON u.id=b.user_id WHERE u.is_showcase=0 AND u.is_active=1 ORDER BY b.copy_cents DESC`).all());
});

module.exports = router;
