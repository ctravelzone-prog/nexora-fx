// autoProfit.js — Daily auto profit apply (Mon–Fri only, Sat/Sun off)
// Business rule (confirmed by owner):
// - One schedule day per weekday, in order (Day 1..22, monthly cycle, target 10%)
// - Profit is calculated on the ORIGINAL copy amount (copy.amount_cents, never
//   compounded) and added to the separate Profit Balance (balances.profit_cents)
//   — the Copy Invested amount itself never changes.
// - Manual Apply (/api/admin/profit/apply) stays as-is for emergencies.
// - Auto opens the day at 10:00 AM (see profitService) and pays the parts
//   every 5 minutes until the day is complete (all parts landed, by 7:00 PM),
//   and never applies twice on the same Dhaka calendar day (guarded by the
//   last applied day's Dhaka date, so a manual Apply earlier that day also
//   blocks auto that day).
// - Sat/Sun in Dhaka time are always skipped, even on a forced run.
// - After all 22 days are applied, auto (ON only) shuffles the NEXT month's
//   schedule once, so the next cycle is ready. If auto is OFF, no shuffle
//   happens — admin clicks Generate Dynamic Shuffle after 22 days.
const { getDb } = require('../models/database');
const { generateSchedule, getSchedule, applyDailyPnl, formatDayRunTime, formatTrickleWindow, formatMinutes, TRICKLE_START_MIN } = require('./profitService');

// Profit times live in profitService as a TRICKLE: each day's PnL is
// paid in one part per copied trader, each part at its own time in the
// 10:00 AM–7:00 PM Dhaka window (partTimes), so the day total is fully
// added by 7:00 PM. The gate below opens the day at 10:00 AM; the
// scheduler then pays the due parts every 5 minutes until the day is
// complete. run_minutes in profit_schedule is now only a legacy anchor.

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
// in the given month, else null — the once-per-day guard.
function lastAppliedDhakaDate(year, month) {
  const row = getDb().prepare(
    'SELECT applied_at FROM profit_schedule WHERE cycle_year=? AND cycle_month=? AND applied=1 ORDER BY day_number DESC LIMIT 1'
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

// Applies one day's profit when it is time: only Mon-Fri, only at or after
// THAT DAY's stored time (that month's shuffle, 12:00 PM–7:00 PM Dhaka), and only once
// per Dhaka day. If the whole month is already applied it generates next
// month's schedule once and applies its Day 1. Returns what was applied
// (or why it skipped).
function runAutoProfit(now = new Date(), opts = {}) {
  const { force = false } = opts; // force bypasses ONLY the day's time gate
  if (!isAutoEnabled()) {
    const pd = dhakaParts(now);
    return { applied: false, reason: 'auto_disabled', dhakaDate: pd.dateStr, weekday: pd.weekday };
  }
  const p = dhakaParts(now);
  if (p.isWeekend) {
    return { applied: false, reason: 'weekend_skip', dhakaDate: p.dateStr, weekday: p.weekday };
  }
  let schedule = getSchedule(p.year, p.month);
  if (!schedule.length) { generateSchedule(p.year, p.month); schedule = getSchedule(p.year, p.month); }
  const next = schedule.find((s) => !s.applied);
  if (!next) {
    // Cycle done: auto (ON only, we already passed the enabled check) shuffles
    // the NEXT month once. Never regenerate the current month (that would
    // wipe the applied history). If auto is OFF this code never runs.
    const nm = nextMonth(p.year, p.month);
    let generated = false;
    if (!getSchedule(nm.year, nm.month).length) { generateSchedule(nm.year, nm.month); generated = true; }
    return { applied: false, reason: 'cycle_complete_next_generated', dhakaDate: p.dateStr, weekday: p.weekday, nextYear: nm.year, nextMonth: nm.month, nextGenerated: generated };
  }
  // Once-per-day guard first (same as before): if today already paid,
  // say so — even when the NEXT day's time has not come yet.
  if (getAutoLastDate() === p.dateStr || lastAppliedDhakaDate(p.year, p.month) === p.dateStr) {
    return { applied: false, reason: 'already_applied_today', dhakaDate: p.dateStr, weekday: p.weekday, day: next.day_number };
  }
  // Today's time gate: the day opens at 10:00 AM (the trickle window).
  // force (admin auto-run) opens it right now and pays every part at once.
  const nowMin = p.hour * 60 + p.minute;
  if (!force && nowMin < TRICKLE_START_MIN) {
    return { applied: false, reason: 'not_yet_today', dhakaDate: p.dateStr, weekday: p.weekday, hour: p.hour, minute: p.minute, day: next.day_number, runTime: formatTrickleWindow() };
  }
  const result = applyDailyPnl(next.rate_bp, p.year, p.month, next.day_number, null, { nowMin, force });
  // Partial day: some parts are still scheduled for later today — do NOT
  // set the once-per-day guard yet, or the remaining parts would never land.
  if (!result.allApplied) {
    return {
      applied: false, reason: 'partial', dhakaDate: p.dateStr, weekday: p.weekday,
      day: next.day_number, rate_bp: next.rate_bp, runTime: formatTrickleWindow(),
      count: result.count, totalApplied: result.totalApplied,
      pending: result.pending, nextPartTime: result.nextPartMin !== null ? formatMinutes(result.nextPartMin) : null,
    };
  }
  setAutoLastDate(p.dateStr);
  // Showcase accounts are paid inside applyDailyPnl (same trickle, same
  // day — result.allApplied already means real AND showcase are done).
  try {
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity,after_value) VALUES (NULL,?,?,?)')
      .run('auto_apply_daily_pnl', `day${next.day_number}/${p.month}/${p.year}`, `rate_bp=${next.rate_bp}`);
  } catch (_) { /* audit log must never break the apply */ }
  return {
    applied: true, dhakaDate: p.dateStr, weekday: p.weekday,
    day: next.day_number, rate_bp: next.rate_bp, runTime: formatTrickleWindow(),
    count: result.count, totalApplied: result.totalApplied, dayTotalApplied: result.dayTotalApplied,
    showcaseCount: result.showcaseCount, showcaseTotalApplied: result.showcaseTotalApplied,
  };
}

// Returns the auto-profit status for the admin panel: on/off, the last
// applied date, today's date (Dhaka) and whether today is a profit day.
function autoStatus(now = new Date()) {
  const p = dhakaParts(now);
  const schedule = getSchedule(p.year, p.month);
  const next = schedule.find((s) => !s.applied) || null;
  return {
    enabled: isAutoEnabled(),
    dhakaDate: p.dateStr, weekday: p.weekday, isWeekend: p.isWeekend, hour: p.hour, minute: p.minute,
    lastAppliedDate: lastAppliedDhakaDate(p.year, p.month),
    nextDay: next ? next.day_number : null,
    nextRateBp: next ? next.rate_bp : null,
    nextRunTime: next ? formatDayRunTime(next) : null,
    cycleComplete: !next && schedule.length > 0,
    nextMonthReady: (!next && schedule.length > 0) ? getSchedule(nextMonth(p.year, p.month).year, nextMonth(p.year, p.month).month).length > 0 : false,
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
      if (r.applied) console.log(`[auto-profit] Applied Day ${r.day} (${r.rate_bp / 100}%) to ${r.count} copies on ${r.dhakaDate} (day total $${(r.dayTotalApplied / 100).toFixed(2)})`);
      else if (r.reason !== 'not_yet_today' && r.reason !== 'partial') console.log(`[auto-profit] Skipped (${r.reason}) on ${r.dhakaDate}`);
    } catch (e) {
      console.error('[auto-profit] Error:', e.message);
    }
  };
  tick(); // check once on startup (gates still apply)
  setInterval(tick, 5 * 60 * 1000); // every 5 minutes
  console.log('[auto-profit] Scheduler started — Mon–Fri, trickle 10:00 AM–7:00 PM Dhaka (one part per copied trader), Sat/Sun skipped');
}

module.exports = { runAutoProfit, autoStatus, startAutoProfit, dhakaParts, isAutoEnabled, setAutoEnabled };
