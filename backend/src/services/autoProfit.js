// autoProfit.js — Daily auto profit apply (Mon–Fri only, Sat/Sun off)
// Business rule (confirmed by owner, v128):
// - One plan day per weekday, in order (Day 1..22, monthly cycle, target 10%)
// - Each trader has their OWN plan (own rates, own loss days); a user
//   copying 1 trader sees that trader's +/−, copying several sees the
//   +/− spread across them. Profit is calculated on the ORIGINAL copy
//   amount (copy.amount_cents, never compounded) and added to the
//   separate Profit Balance (balances.profit_cents) — the Copy Invested
//   amount itself never changes. Day 22 balances each copy to exactly
//   its month target.
// - Manual Apply (/api/admin/profit/apply) stays as-is for emergencies.
// - Auto opens the day at 10:00 AM (see profitService) and pays the parts
//   every 5 minutes until the day is complete (all parts landed, by 7:00 PM),
//   and never applies twice on the same Dhaka calendar day (guarded by the
//   last applied day's Dhaka date, so a manual Apply earlier that day also
//   blocks auto that day).
// - Sat/Sun in Dhaka time are always skipped, even on a forced run.
// - After all 22 days are applied, auto (ON only) generates the NEXT
//   month's trader plans once, so the next cycle is ready. If auto is
//   OFF, no generation happens — admin clicks Generate after 22 days.
const { getDb, getMainDb, getShowcaseDb } = require('../models/database');
const { generateTraderPlans, traderPlansExist, currentCycleDay, globalNextDay, getTraderPlans, applyDailyPnl, formatTrickleWindow, formatMinutes, TRICKLE_START_MIN } = require('./profitService');

// Returns the year/month/day of a Date in Asia/Dhaka time.
function dhakaParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const wd = get('weekday'); // Sun, Mon, Tue, Wed, Thu, Fri, Sat
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    weekday: wd,
    isWeekend: wd === 'Sat' || wd === 'Sun',
    hour: parseInt(get('hour'), 10) % 24,
    minute: parseInt(get('minute'), 10),
    dateStr: `${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`,
  };
}

// Returns the last auto-applied Dhaka date (YYYY-MM-DD) when it falls
// in the given month, else null — the once-per-day guard. Reads the
// latest applied trader-plan row (any trader).
function lastAppliedDhakaDate(year, month) {
  const row = getDb().prepare(
    'SELECT applied_at FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? AND applied=1 ORDER BY applied_at DESC LIMIT 1'
  ).get(year, month);
  if (!row || !row.applied_at) return null;
  return dhakaParts(new Date(row.applied_at * 1000)).dateStr;
}

// Returns the last auto-applied date string, or null when never run.
function getAutoLastDate() {
  try {
    const row = getDb().prepare("SELECT value FROM site_settings WHERE key='auto_profit_last_date'").get();
    return row ? row.value : null;
  } catch (_) { return null; }
}

// Records the last auto-applied date (settings key auto_profit_last_date).
function setAutoLastDate(dateStr) {
  try {
    getDb().prepare("INSERT INTO site_settings (key,value) VALUES ('auto_profit_last_date',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(dateStr);
  } catch (_) { /* never break the apply */ }
}
// Syncs every copy's Daily PnL from today's log, once per Dhaka day,
// at/after midnight (Siam 10 Nov 2026): without this, a copy whose part
// has not landed yet today keeps showing yesterday's Daily PnL — Ethan
// Tan showed Day-1 +$2.40 on Day 2 before his part landed. A copy whose
// part ALREADY landed today keeps today's amount; the rest go to $0.00.
// (A blind reset to 0 would wipe parts that landed before the first run
// after deploy — that bug was caught and fixed in v128.12.) Runs in BOTH
// databases (real + showcase users, same rule) and on every day,
// including Sat/Sun (no profit then, so the display must be $0.00, not
// Friday's). Idempotent: the reset date is stored in site_settings, so
// a second call the same day is a no-op.
function resetDailyPnlIfDue(now = new Date()) {
  const p = dhakaParts(now);
  const today = p.dateStr;
  let last = null;
  try {
    const row = getDb().prepare("SELECT value FROM site_settings WHERE key='daily_pnl_reset_date'").get();
    last = row ? row.value : null;
  } catch (_) {}
  if (last === today) return { reset: false, date: today };
  const day = currentCycleDay(p.year, p.month);
  let mainN = 0, scN = 0;
  const syncDb = (db) => {
    if (day === null) return db.prepare('UPDATE copies SET daily_pnl_cents=0').run().changes;
    return db.prepare('UPDATE copies SET daily_pnl_cents=COALESCE((SELECT amount_cents FROM daily_pnl_log WHERE copy_id=copies.id AND cycle_year=? AND cycle_month=? AND day_number=?),0)').run(p.year, p.month, day).changes;
  };
  try { mainN = syncDb(getMainDb()); } catch (_) {}
  try { scN = syncDb(getShowcaseDb()); } catch (_) {}
  try {
    getDb().prepare("INSERT INTO site_settings (key,value) VALUES ('daily_pnl_reset_date',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(today);
  } catch (_) {}
  return { reset: true, date: today, main: mainN, showcase: scN };
}

// True when the auto-profit switch is on (default ON).
function isAutoEnabled() {
  try {
    const row = getDb().prepare("SELECT value FROM site_settings WHERE key='auto_profit_enabled'").get();
    if (!row) return true; // default ON (owner confirmed auto)
    return row.value !== '0';
  } catch (_) { return true; }
}

// Turns the auto-profit switch on or off.
function setAutoEnabled(enabled) {
  try {
    getDb().prepare("INSERT INTO site_settings (key,value) VALUES ('auto_profit_enabled',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(enabled ? '1' : '0');
  } catch (_) {}
  return enabled;
}

// Returns the year/month after the given month (rolls over December).
function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// The per-trader rates for one plan day (for status + logs).
function dayRates(year, month, day) {
  return getTraderPlans(year, month)
    .filter(r => r.day_number === day)
    .map(r => ({ trader_id: r.trader_id, trader_name: r.trader_name, rate_bp: r.rate_bp, is_loss: r.is_loss }));
}

// Applies one day's profit when it is time: only Mon-Fri, only at or after
// 10:00 AM Dhaka, and only once per Dhaka day. If the whole month is
// already applied it generates next month's trader plans once and applies
// its Day 1. Returns what was applied (or why it skipped).
function runAutoProfit(now = new Date(), opts = {}) {
  const { force = false } = opts; // force bypasses ONLY the day's time gate
  resetDailyPnlIfDue(now); // Daily PnL clears at midnight, before any part lands
  if (!isAutoEnabled()) {
    const pd = dhakaParts(now);
    return { applied: false, reason: 'auto_disabled', dhakaDate: pd.dateStr, weekday: pd.weekday };
  }
  const p = dhakaParts(now);
  if (p.isWeekend) {
    return { applied: false, reason: 'weekend_skip', dhakaDate: p.dateStr, weekday: p.weekday };
  }
  // First generation for a month that already started uses the next
  // unapplied day of the legacy global schedule as the start day
  // (November: Day 1 was already paid under the old system, so the
  // trader plans start at Day 2). A fresh month starts at Day 1.
  if (!traderPlansExist(p.year, p.month)) { generateTraderPlans(p.year, p.month, globalNextDay(p.year, p.month)); }
  const nextDay = currentCycleDay(p.year, p.month);
  if (nextDay === null) {
    // Cycle done: auto (ON only, we already passed the enabled check)
    // generates the NEXT month's trader plans once. Never regenerate
    // the current month (that would wipe the applied history). If auto
    // is OFF this code never runs.
    const nm = nextMonth(p.year, p.month);
    let generated = false;
    if (!traderPlansExist(nm.year, nm.month)) { generateTraderPlans(nm.year, nm.month, 1); generated = true; }
    return { applied: false, reason: 'cycle_complete_next_generated', dhakaDate: p.dateStr, weekday: p.weekday, nextYear: nm.year, nextMonth: nm.month, nextGenerated: generated };
  }
  // Once-per-day guard: if today already FULLY paid, say so — even
  // when the NEXT day's time has not come yet. Only getAutoLastDate()
  // is checked here: it is set ONLY on a full apply (below).
  // lastAppliedDhakaDate must NOT be part of this guard — it returns
  // today as soon as ANY single trader's row is marked applied, which
  // would block the REST of a partial day's parts from ever landing
  // (the exact failure the 'partial' branch below guards against).
  // applyDailyPnl is idempotent (hasLog), so a re-run can never
  // double-pay even if this guard were ever missed.
  if (getAutoLastDate() === p.dateStr) {
    return { applied: false, reason: 'already_applied_today', dhakaDate: p.dateStr, weekday: p.weekday, day: nextDay };
  }
  // Today's time gate: the day opens at 10:00 AM (the trickle window).
  // force (admin auto-run) opens it right now and pays every part at once.
  const nowMin = p.hour * 60 + p.minute;
  if (!force && nowMin < TRICKLE_START_MIN) {
    return { applied: false, reason: 'not_yet_today', dhakaDate: p.dateStr, weekday: p.weekday, hour: p.hour, minute: p.minute, day: nextDay, runTime: formatTrickleWindow() };
  }
  const result = applyDailyPnl(p.year, p.month, nextDay, null, { nowMin, force });
  // Partial day: some parts are still scheduled for later today — do NOT
  // set the once-per-day guard yet, or the remaining parts would never land.
  if (!result.allApplied) {
    return {
      applied: false, reason: 'partial', dhakaDate: p.dateStr, weekday: p.weekday,
      day: nextDay, traderRates: dayRates(p.year, p.month, nextDay), runTime: formatTrickleWindow(),
      count: result.count, totalApplied: result.totalApplied,
      pending: result.pending, nextPartTime: result.nextPartMin !== null ? formatMinutes(result.nextPartMin) : null,
    };
  }
  setAutoLastDate(p.dateStr);
  // Showcase accounts are paid inside applyDailyPnl (same trickle, same
  // day — result.allApplied already means real AND showcase are done).
  try {
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity,after_value) VALUES (NULL,?,?,?)')
      .run('auto_apply_daily_pnl', `day${nextDay}/${p.month}/${p.year}`, `day_total_cents=${result.dayTotalApplied}`);
  } catch (_) { /* audit log must never break the apply */ }
  return {
    applied: true, dhakaDate: p.dateStr, weekday: p.weekday,
    day: nextDay, traderRates: dayRates(p.year, p.month, nextDay), runTime: formatTrickleWindow(),
    count: result.count, totalApplied: result.totalApplied, dayTotalApplied: result.dayTotalApplied,
    showcaseCount: result.showcaseCount, showcaseTotalApplied: result.showcaseTotalApplied,
  };
}

// Returns the auto-profit status for the admin panel: on/off, the last
// applied date, today's date (Dhaka) and whether today is a profit day.
function autoStatus(now = new Date()) {
  const p = dhakaParts(now);
  const hasPlans = traderPlansExist(p.year, p.month);
  const nextDay = hasPlans ? currentCycleDay(p.year, p.month) : null;
  const nm = nextMonth(p.year, p.month);
  return {
    enabled: isAutoEnabled(),
    dhakaDate: p.dateStr, weekday: p.weekday, isWeekend: p.isWeekend, hour: p.hour, minute: p.minute,
    lastAppliedDate: lastAppliedDhakaDate(p.year, p.month),
    nextDay,
    nextRates: nextDay !== null ? dayRates(p.year, p.month, nextDay) : [],
    nextRunTime: nextDay !== null ? formatTrickleWindow() : null,
    cycleComplete: hasPlans && nextDay === null,
    nextMonthReady: hasPlans && nextDay === null ? traderPlansExist(nm.year, nm.month) : false,
  };
}

// Starts the scheduler: runs once on boot, then checks every 5 min (the
// 20-minute time steps are multiples of 5, so the apply lands on the
// exact minute; the server only runs it while it is up — a spun-down
// host pauses it).
function startAutoProfit() {
  const tick = () => {
    try {
      const r = runAutoProfit(new Date());
      if (r.applied) console.log(`[auto-profit] Applied Day ${r.day} to ${r.count} copies on ${r.dhakaDate} (day total $${(r.dayTotalApplied / 100).toFixed(2)})`);
      else if (r.reason !== 'not_yet_today' && r.reason !== 'partial') console.log(`[auto-profit] Skipped (${r.reason}) on ${r.dhakaDate}`);
    } catch (e) {
      console.error('[auto-profit] Error:', e.message);
    }
  };
  tick(); // check once on startup (gates still apply)
  setInterval(tick, 5 * 60 * 1000); // every 5 minutes
  console.log('[auto-profit] Scheduler started — Mon–Fri, trickle 10:00 AM–7:00 PM Dhaka (one part per copied trader, per-trader plans), Sat/Sun skipped');
}

module.exports = { runAutoProfit, autoStatus, startAutoProfit, dhakaParts, isAutoEnabled, setAutoEnabled, resetDailyPnlIfDue };
