// routes/admin/profit.js — per-trader profit plans, manual apply and auto-profit (v128).
// GET /trader-plans returns every trader's 22-day plan for a month +
// the account total per day. POST /trader-plans/generate regenerates
// all plans; PUT /trader-plan/:traderId/:year/:month/:day edits one
// trader's one day rate and rebalances only that trader. POST /apply
// applies one day manually (optionally to one user only).
// GET /auto-status, POST /auto-run and POST /auto-toggle control the
// auto-profit scheduler. GET /user-data lists real users with their
// copies and per-user profit targets; GET /showcase-users lists the
// showcase accounts the same way (separate DB, never in admin totals).
// Rule: each trader's plan sums to the Money Settings target by Day 22;
// Day 22 always balances the month to exactly the target — target
// wording, never a guarantee.
const router = require('express').Router();
const { getDb, getShowcaseDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');
const { generateTraderPlans, getTraderPlans, getTraderPlan, traderPlansExist, globalNextDay, rebalanceTraderPlan, applyDailyPnl } = require('../../services/profitService');
const { runAutoProfit, autoStatus, isAutoEnabled, setAutoEnabled } = require('../../services/autoProfit');

// Account total per day (real users only): for each day, the sum of
// (trader rate x that trader's total copied amount) across all active
// real copies, and the day's % of total Copy Invested.
function accountTotals(year, month, plans) {
  const db = getDb();
  const copied = {};
  for (const r of db.prepare("SELECT trader_id, COALESCE(SUM(amount_cents),0) AS t FROM copies WHERE status='active' GROUP BY trader_id").all()) copied[r.trader_id] = r.t;
  const totalCopied = Object.values(copied).reduce((a, b) => a + b, 0);
  const byDay = {};
  for (const p of plans) {
    if (!byDay[p.day_number]) byDay[p.day_number] = { day: p.day_number, total_bp: 0, total_cents: 0 };
    const amt = copied[p.trader_id] || 0;
    byDay[p.day_number].total_cents += Math.round(amt * p.rate_bp / 10000);
  }
  return Object.values(byDay).sort((a, b) => a.day - b.day).map(d => ({
    day: d.day, total_cents: d.total_cents,
    total_bp: totalCopied > 0 ? Math.round(d.total_cents * 10000 / totalCopied) : 0,
    total_copied_cents: totalCopied,
  }));
}

// GET /trader-plans — every trader's plan for the month (generated
// first when the month has none yet — full month, from Day 1).
// Query: ?year= &month=.
router.get('/trader-plans', authAdmin, (req, res) => {
  const now = new Date(); const { year = now.getFullYear(), month = now.getMonth() + 1 } = req.query;
  const y = parseInt(year), m = parseInt(month);
  if (!traderPlansExist(y, m)) generateTraderPlans(y, m, globalNextDay(y, m));
  const plans = getTraderPlans(y, m);
  const traders = [...new Map(plans.map(p => [p.trader_id, { id: p.trader_id, name: p.trader_name }])).values()];
  res.json({ plans, traders, accountTotals: accountTotals(y, m, plans), year: y, month: m });
});

// POST /trader-plans/generate — Super Admin only. Regenerates every
// plannable trader's plan for the month (new random rates; applied
// days are kept, only future days are rebuilt).
router.post('/trader-plans/generate', authAdmin, superAdminOnly, (req, res) => {
  const now = new Date(); const { year = now.getFullYear(), month = now.getMonth() + 1 } = req.body;
  const plans = generateTraderPlans(parseInt(year), parseInt(month), 1);
  getDb().prepare('INSERT INTO audit_log (admin_id,action,entity) VALUES (?,?,?)').run(req.adminId, 'generate_trader_plans', `${year}-${month}`);
  res.json({ success: true, plans: getTraderPlans(parseInt(year), parseInt(month)) });
});

// PUT /trader-plan/:traderId/:year/:month/:day — Super Admin only.
// Edits one trader's one day rate, then rebalances ONLY that trader's
// remaining days so their month total is unchanged.
router.put('/trader-plan/:traderId/:year/:month/:day', authAdmin, superAdminOnly, (req, res) => {
  try {
    const { rate_bp } = req.body;
    if (rate_bp === undefined) return res.status(400).json({ error: 'rate_bp required' });
    const { traderId, year, month, day } = req.params;
    rebalanceTraderPlan(parseInt(year), parseInt(month), parseInt(traderId), parseInt(day), parseInt(rate_bp));
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity,after_value) VALUES (?,?,?,?)').run(req.adminId, 'manual_trader_plan_edit', `trader${traderId}/day${day}/${month}/${year}`, `rate_bp=${rate_bp}`);
    res.json({ success: true, plan: getTraderPlan(parseInt(year), parseInt(month), parseInt(traderId)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /apply — applies one plan day manually. Body: day_number, year,
// month, optional user_id (one user only; a single-user apply never
// touches showcase accounts). Rates come from the trader plans.
router.post('/apply', authAdmin, (req, res) => {
  try {
    const { day_number, year, month, user_id, force } = req.body;
    if (!day_number || !year || !month) return res.status(400).json({ error: 'day_number, year, month required' });
    // A full (not single-user) manual apply also pays showcase accounts
    // the same per-trader plans, trickled — applyDailyPnl handles it.
    // force=true pays every part at once (admin emergency / test use).
    const result = applyDailyPnl(parseInt(year), parseInt(month), parseInt(day_number), user_id ? parseInt(user_id) : null, { force: force === true });
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity) VALUES (?,?,?)').run(req.adminId, 'apply_daily_pnl', `day${day_number}/${month}/${year}${force === true ? ' (forced)' : ''}`);
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /auto-status — the auto-profit scheduler state (on/off, last
// applied date, whether today is a profit day).
router.get('/auto-status', authAdmin, (req, res) => {
  res.json(autoStatus(new Date()));
});

// POST /auto-run — runs the auto-profit check once, right now (same
// Mon-Fri / day's shuffled time / once-per-day rules as the scheduler).
router.post('/auto-run', authAdmin, (req, res) => {
  // Emergency/test trigger for the auto logic: bypasses only the day's time gate.
  // Weekend skip + once-per-day guard still apply, so it can never double-apply.
  try { res.json({ success: true, ...runAutoProfit(new Date(), { force: true }) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /auto-toggle — turns the auto-profit scheduler on or off.
router.post('/auto-toggle', authAdmin, (req, res) => {
  const enabled = req.body && typeof req.body.enabled === 'boolean' ? req.body.enabled : !isAutoEnabled();
  setAutoEnabled(enabled);
  res.json({ success: true, enabled });
});

// GET /user-data — users with their copies and per-user profit
// targets, for the Profit System page.
router.get('/user-data', authAdmin, (req, res) => {
  const db = getDb();
  res.json(db.prepare(`SELECT u.id,u.full_name,u.username,u.profit_target_bp,b.total_deposited_cents,b.copy_cents,b.profit_cents,COALESCE((SELECT SUM(amount_cents) FROM daily_pnl_log WHERE user_id=u.id),0) as total_pnl_cents,(SELECT COUNT(*) FROM copies WHERE user_id=u.id AND status='active') as active_copies FROM users u JOIN balances b ON u.id=b.user_id WHERE u.is_showcase=0 AND u.is_active=1 ORDER BY b.copy_cents DESC`).all());
});

// GET /showcase-users — showcase accounts with their copies and
// per-user profit targets (showcase DB only; never in admin totals).
router.get('/showcase-users', authAdmin, (req, res) => {
  const db = getShowcaseDb();
  res.json(db.prepare(`SELECT u.id,u.full_name,u.username,u.email,u.profit_target_bp,u.showcase_main_cents,u.showcase_copy_cents,u.showcase_profit_cents,u.showcase_withdraw_cents,COALESCE((SELECT SUM(amount_cents) FROM daily_pnl_log WHERE user_id=u.id),0) as total_pnl_cents,(SELECT COUNT(*) FROM copies WHERE user_id=u.id AND status='active') as active_copies FROM users u WHERE u.is_showcase=1 ORDER BY u.showcase_copy_cents DESC`).all());
});

module.exports = router;
