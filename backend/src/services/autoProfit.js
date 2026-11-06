// autoProfit.js — Daily auto profit apply (Mon–Fri only, Sat/Sun off)
// Business rule (confirmed by owner):
// - One schedule day per weekday, in order (Day 1..22, monthly cycle, target 10%)
// - Profit is calculated on the ORIGINAL copy amount (copy.amount_cents, never
//   compounded) and added to the separate Profit Balance (balances.profit_cents)
//   — the Copy Invested amount itself never changes.
// - Manual Apply (/api/admin/profit/apply) stays as-is for emergencies.
// - Auto runs at/after 12:00 PM Dhaka time, every 15 minutes, and never applies
//   twice on the same Dhaka calendar day (guarded by the last applied day's
//   Dhaka date, so a manual Apply earlier that day also blocks auto that day).
// - Sat/Sun in Dhaka time are always skipped, even on a forced run.
// - After all 22 days are applied, auto (ON only) shuffles the NEXT month's
//   schedule once, so the next cycle is ready. If auto is OFF, no shuffle
//   happens — admin clicks Generate Dynamic Shuffle after 22 days.
const { getDb } = require('../models/database');
const { generateSchedule, getSchedule, applyDailyPnl } = require('./profitService');

const AUTO_HOUR_DHAKA = 12; // 12:00 PM Dhaka (noon)

// Returns the year/month/day of a Date in Asia/Dhaka time.
function dhakaParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: 'numeric', hour12: false,
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

// Applies one day's profit when it is time: only Mon-Fri, only at or
// after 12:00 PM Dhaka, and only once per Dhaka day. If the whole month
// is already applied it generates next month's schedule once and applies
// its Day 1. Returns what was applied (or why it skipped).
function runAutoProfit(now = new Date(), opts = {}) {
  const { force = false } = opts; // force bypasses ONLY the 12 PM time gate
  if (!isAutoEnabled()) {
    const pd = dhakaParts(now);
    return { applied: false, reason: 'auto_disabled', dhakaDate: pd.dateStr, weekday: pd.weekday };
  }
  const p = dhakaParts(now);
  if (p.isWeekend) {
    return { applied: false, reason: 'weekend_skip', dhakaDate: p.dateStr, weekday: p.weekday };
  }
  if (!force && p.hour < AUTO_HOUR_DHAKA) {
    return { applied: false, reason: 'not_yet_12pm_dhaka', dhakaDate: p.dateStr, weekday: p.weekday, hour: p.hour };
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
  if (getAutoLastDate() === p.dateStr || lastAppliedDhakaDate(p.year, p.month) === p.dateStr) {
    return { applied: false, reason: 'already_applied_today', dhakaDate: p.dateStr, weekday: p.weekday, day: next.day_number };
  }
  const result = applyDailyPnl(next.rate_bp, p.year, p.month, next.day_number, null);
  setAutoLastDate(p.dateStr);
  try {
    getDb().prepare('INSERT INTO audit_log (admin_id,action,entity,after_value) VALUES (NULL,?,?,?)')
      .run('auto_apply_daily_pnl', `day${next.day_number}/${p.month}/${p.year}`, `rate_bp=${next.rate_bp}`);
  } catch (_) { /* audit log must never break the apply */ }
  return {
    applied: true, dhakaDate: p.dateStr, weekday: p.weekday,
    day: next.day_number, rate_bp: next.rate_bp,
    count: result.count, totalApplied: result.totalApplied,
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
    dhakaDate: p.dateStr, weekday: p.weekday, isWeekend: p.isWeekend, hour: p.hour,
    autoHour: AUTO_HOUR_DHAKA,
    lastAppliedDate: lastAppliedDhakaDate(p.year, p.month),
    nextDay: next ? next.day_number : null,
    nextRateBp: next ? next.rate_bp : null,
    cycleComplete: !next && schedule.length > 0,
    nextMonthReady: (!next && schedule.length > 0) ? getSchedule(nextMonth(p.year, p.month).year, nextMonth(p.year, p.month).month).length > 0 : false,
  };
}

// Starts the scheduler: runs once on boot, then checks every 15 min
// (the server only runs it while it is up — a spun-down host pauses it).
function startAutoProfit() {
  const tick = () => {
    try {
      const r = runAutoProfit(new Date());
      if (r.applied) console.log(`[auto-profit] Applied Day ${r.day} (${r.rate_bp / 100}%) to ${r.count} copies on ${r.dhakaDate}`);
      else if (r.reason !== 'not_yet_12pm_dhaka') console.log(`[auto-profit] Skipped (${r.reason}) on ${r.dhakaDate}`);
    } catch (e) {
      console.error('[auto-profit] Error:', e.message);
    }
  };
  tick(); // check once on startup (gates still apply)
  setInterval(tick, 15 * 60 * 1000); // every 15 minutes
  console.log('[auto-profit] Scheduler started — Mon–Fri, 12:00 PM Dhaka, Sat/Sun skipped');
}

module.exports = { runAutoProfit, autoStatus, startAutoProfit, dhakaParts, isAutoEnabled, setAutoEnabled };
