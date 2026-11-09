// services/profitService.js — per-trader 22-day profit plans (v128).
// Each trader has their OWN 22-day plan (own loss days, own rates), each
// summing to the Money Settings target (default 10%) by Day 22 — so on a
// loss day some traders pay and some lose, never all together. A user
// copying 1 trader sees that trader's +/−; copying 3–6 sees the +/−
// spread across them. Parts land one by one 10:00 AM–7:00 PM Dhaka
// (partTimes), each with its own Trade History row + notification.
// Day 22 is the balancing day: it pays exactly what remains so the
// trader's month lands on the target (to the cent, per copy).
// Plans live in the MAIN DB (trader_profit_schedule) and apply to BOTH
// real users (main DB) and showcase accounts (showcase DB, display
// money only — no transactions, never in admin totals or ledgers).
// A trader added mid-month joins the month's plan from the add day and
// earns only the REMAINING percent (Day 11 → ~5%); a full 10% starts
// the next full month. Removing a trader deletes their future plan
// rows; past History stays. Profit is on the first copied amount, no
// compounding. The target is a target, never a guarantee.
const { getDb, getMainDb, getShowcaseDb } = require('../models/database');
const H = require('./moneyHelpers');

// Global cycle target in basis points (100 = 1%). Admin sets it in Money Settings.
function getTargetBp() { const v = parseInt(H.getSetting('profit_target_bp','1000')); return Number.isFinite(v) && v >= 0 ? v : 1000; }

// Seeded PRNG helpers (deterministic per seed string — every scheduler
// tick agrees on the same times and splits).
function _hashSeed(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function _mulberry32(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
// Splits a day total (cents, may be negative) across copy amounts with
// per-trader variation. Returns integer amounts summing exactly to total.
// (Kept for the backfill script + tests; the v128 apply no longer splits
// one total across traders — each trader pays their own plan rate.)
function variedSplit(seedKey, amounts, total){
  if(amounts.length<=1) return [total];
  const rnd=_mulberry32(_hashSeed(seedKey));
  const w=amounts.map(()=>0.7+rnd()*0.6); // 0.7-1.3x per copy
  const totAmt=amounts.reduce((a,b)=>a+b,0);
  const wAvg=amounts.reduce((s,a,i)=>s+a*w[i],0)/totAmt;
  const shares=amounts.map((a,i)=>Math.round(total*a*(w[i]/wAvg)/totAmt));
  let diff=total-shares.reduce((a,b)=>a+b,0);
  if(diff!==0){ let bi=0; amounts.forEach((a,i)=>{ if(a>amounts[bi]) bi=i; }); shares[bi]+=diff; }
  return shares;
}

function formatMinutes(mins) {
  const hour = Math.floor(mins / 60), minute = mins % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
// Minutes since midnight (Dhaka) right now — the trickle clock.
function dhakaNowMin() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
}
// One payout time per copy, spread across the 10:00 AM-7:00 PM window.
// The window is split into copyCount equal slots, the slot order is
// shuffled deterministically from the seed, and each time gets a small
// +/-10 min jitter so the times never look mechanical. Returns an array
// of minutes-since-midnight, index = the copy's index in its user's
// copy list (ORDER BY id, same as the apply uses).
const TRICKLE_START_MIN = 10 * 60; // 10:00 AM Dhaka
const TRICKLE_END_MIN = 19 * 60; // 7:00 PM Dhaka
function partTimes(seedKey, copyCount) {
  const n = Math.max(1, copyCount | 0);
  const rng = _mulberry32(_hashSeed(seedKey));
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const width = (TRICKLE_END_MIN - TRICKLE_START_MIN) / n;
  const times = new Array(n);
  for (let i = 0; i < n; i++) {
    const jitter = Math.floor(rng() * 21) - 10;
    times[i] = Math.min(TRICKLE_END_MIN, Math.max(TRICKLE_START_MIN, Math.round(TRICKLE_START_MIN + (order[i] + 0.5) * width + jitter)));
  }
  return times;
}
// The day's payout window (display): parts land across it, not at one time.
function formatTrickleWindow() { return formatMinutes(TRICKLE_START_MIN) + ' – ' + formatMinutes(TRICKLE_END_MIN); }
function formatDayRunTime(row) {
  return formatTrickleWindow();
}

const CYCLE_DAYS = 22;

// Splits a total into varied daily rates: random weights scaled to the
// total, the last rate adjusted so the sum is exact, then shuffled.
function variedRates(count, total) {
  if(count<=0) return [];
  const raw = Array.from({length:count},()=>10+Math.random()*60);
  const s = raw.reduce((a,b)=>a+b,0);
  const sc = raw.map(r=>Math.round(r/s*total));
  sc[sc.length-1] += total - sc.reduce((a,b)=>a+b,0);
  for(let i=sc.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[sc[i],sc[j]]=[sc[j],sc[i]]; }
  return sc;
}

// Picks n loss-day positions at random from days 2 to total-1 (never
// Day 1 or the last day).
function pickLossPos(total, n) {
  const avail=[]; for(let i=2;i<=total-1;i++) avail.push(i);
  const pos=[];
  while(pos.length<n){ pos.push(avail.splice(Math.floor(Math.random()*avail.length),1)[0]); }
  return pos;
}

// Builds one trader's 22 daily rates from the target: 2 or 3 loss days
// (-20 to -40 bp, never Day 1 or Day 22), varied positive rates, and
// Day 22 set to the exact remainder so the plan lands on the target.
// Pure (no DB) — the caller decides which days to store.
function buildPlanRates(targetBp) {
  const lossCount = Math.random() < 0.5 ? 2 : 3;
  const posCount = CYCLE_DAYS - lossCount;
  const lossRates = Array.from({length:lossCount},()=>-(20+Math.floor(Math.random()*21)));
  const totalLossBp = lossRates.reduce((a,b)=>a+b,0);
  const totalPosBp = targetBp - totalLossBp;
  const posRates = variedRates(posCount, totalPosBp);
  const lossPos = pickLossPos(CYCLE_DAYS, lossCount);
  const days = [];
  let pi=0, li=0;
  for(let i=1;i<=CYCLE_DAYS;i++){
    if(lossPos.includes(i)) days.push({day:i,rate:lossRates[li++],isLoss:1});
    else days.push({day:i,rate:posRates[pi++],isLoss:0});
  }
  const sumWithout22 = days.slice(0,21).reduce((a,r)=>a+r.rate,0);
  days[21].rate = targetBp - sumWithout22;
  days[21].isLoss = days[21].rate < 0 ? 1 : 0;
  return days;
}

// Traders that need a plan: visible ones, plus hidden ones that still
// have active copies (their existing copies keep earning).
function getPlannableTraders() {
  const main = getMainDb();
  const traders = main.prepare('SELECT * FROM traders ORDER BY id').all();
  const sc = getShowcaseDb();
  return traders.filter(t => {
    if (!t.is_hidden) return true;
    const inMain = main.prepare("SELECT 1 FROM copies WHERE trader_id=? AND status='active' LIMIT 1").get(t.id);
    if (inMain) return true;
    const inSc = sc.prepare("SELECT 1 FROM copies WHERE trader_id=? AND status='active' LIMIT 1").get(t.id);
    return !!inSc;
  });
}

// Generates (or regenerates) one trader's plan for a month. A fresh
// full 22-day plan is built from the target, but only days >= fromDay
// are stored — a trader added on Day N joins the month's plan from
// Day N and earns only the remaining percent (the stored days sum to
// it). fromDay=1 for a full month. Applied (already paid) rows are
// never deleted or changed; only the unapplied (future) rows are
// rebuilt, so a re-add gets a brand-new plan for its remaining days.
function generateTraderPlan(year, month, traderId, fromDay) {
  const db = getMainDb();
  const fd = Math.max(1, Math.min(CYCLE_DAYS, fromDay || 1));
  const rates = buildPlanRates(getTargetBp());
  const appliedDays = new Set(db.prepare('SELECT day_number FROM trader_profit_schedule WHERE trader_id=? AND cycle_year=? AND cycle_month=? AND applied=1').all(traderId, year, month).map(r => r.day_number));
  const ins = db.prepare('INSERT INTO trader_profit_schedule (trader_id,cycle_year,cycle_month,day_number,rate_bp,is_loss) VALUES (?,?,?,?,?,?)');
  return db.transaction(() => {
    db.prepare('DELETE FROM trader_profit_schedule WHERE trader_id=? AND cycle_year=? AND cycle_month=? AND applied=0').run(traderId, year, month);
    const rows = [];
    for (const d of rates) {
      if (d.day < fd || appliedDays.has(d.day)) continue;
      ins.run(traderId, year, month, d.day, d.rate, d.isLoss);
      rows.push({ trader_id: traderId, cycle_year: year, cycle_month: month, day_number: d.day, rate_bp: d.rate, is_loss: d.isLoss, applied: 0, applied_at: null });
    }
    return rows;
  })();
}

// Generates plans for every plannable trader (used by Generate + the
// next-month auto-generation). fromDay applies to all (1 = full month).
function generateTraderPlans(year, month, fromDay) {
  const out = {};
  for (const t of getPlannableTraders()) out[t.id] = generateTraderPlan(year, month, t.id, fromDay || 1);
  return out;
}

// True when the month has any trader plan rows at all.
function traderPlansExist(year, month) {
  return getMainDb().prepare('SELECT 1 FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? LIMIT 1').get(year, month) !== undefined;
}

// All plan rows for a month, with trader names, ordered by trader, day.
function getTraderPlans(year, month) {
  return getMainDb().prepare(`SELECT p.*, t.name AS trader_name FROM trader_profit_schedule p JOIN traders t ON p.trader_id=t.id WHERE p.cycle_year=? AND p.cycle_month=? ORDER BY p.trader_id, p.day_number`).all(year, month);
}
function getTraderPlan(year, month, traderId) {
  return getMainDb().prepare('SELECT * FROM trader_profit_schedule WHERE trader_id=? AND cycle_year=? AND cycle_month=? ORDER BY day_number').all(traderId, year, month);
}

// The next unapplied day in the LEGACY global profit_schedule (used
// only as a safe start day when trader plans are first generated for a
// month that already started — e.g. the November v128 cutover, where
// Day 1 was already paid under the old system). Returns 1 when the
// month has no global schedule (a fresh month).
function globalNextDay(year, month) {
  const row = getMainDb().prepare('SELECT MIN(day_number) AS d FROM profit_schedule WHERE cycle_year=? AND cycle_month=? AND applied=0').get(year, month);
  return row && row.d !== null && row.d !== undefined ? row.d : 1;
}

// The current cycle day: the smallest day with an unapplied plan row
// among plannable traders. Null when no plans exist yet for the month,
// or when the cycle is complete (all 22 days applied).
function currentCycleDay(year, month) {
  const traders = getPlannableTraders().map(t => t.id);
  if (!traders.length) return null;
  const placeholders = traders.map(() => '?').join(',');
  const row = getMainDb().prepare(`SELECT MIN(day_number) AS d FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? AND applied=0 AND trader_id IN (${placeholders})`).get(year, month, ...traders);
  return row && row.d !== null && row.d !== undefined ? row.d : null;
}

// The cycle start date (Dhaka) for a month: the date the Day-1 plan
// row was applied. Null when Day 1 has not been applied yet. The cycle
// does not always start on the 1st of the month (November 2026 started
// on Mon 9 Nov), so the cycle day of a date is counted from the cycle
// start, not from the 1st.
function cycleStartDate(year, month) {
  const row = getMainDb().prepare('SELECT MIN(applied_at) AS at FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? AND day_number=1 AND applied=1').get(year, month);
  if (!row || !row.at) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(row.at * 1000));
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`;
}
// The cycle day a copy starts earning (1..22, or 23 = next cycle).
// Copies created before the cycle start at Day 1. A weekend start date
// earns from the next weekday.
function copyStartDay(copy, year, month) {
  if (!copy.cycle_start_date) return 1;
  const [y, m] = copy.cycle_start_date.split('-').map(Number);
  if (y < year || (y === year && m < month)) return 1;
  if (y > year || (y === year && m > month)) return CYCLE_DAYS + 1;
  const start = cycleStartDate(year, month);
  if (!start) return 1; // cycle has not started yet — earns from Day 1
  if (copy.cycle_start_date < start) return 1; // created before the cycle
  const [sy, sm, sd] = start.split('-').map(Number);
  const [cy, cm, cd] = copy.cycle_start_date.split('-').map(Number);
  let count = 0;
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(cy, cm - 1, cd));
  while (cur <= end) {
    const wd = cur.getUTCDay();
    if (wd !== 0 && wd !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  const wdEnd = end.getUTCDay();
  if (wdEnd === 0 || wdEnd === 6) count++;
  return count > CYCLE_DAYS ? CYCLE_DAYS + 1 : count;
}

// After an admin edits one trader's one day rate: writes the edited
// rate, then re-spreads that trader's remaining unapplied days (except
// Day 22) proportionally so the trader's month total is unchanged
// (the total is the sum of the stored rows before the edit — for a
// mid-month plan that is the remaining percent, not the full target);
// Day 22 (if unapplied) is set to the exact remainder. Applied days
// are never changed. Other traders are untouched.
// Edit one day of one trader's plan and rebalance ONLY that trader's
// remaining days, so the plan total is preserved exactly. The pool that
// absorbs the change is the unapplied days AFTER the edited day (Day 22
// included) — they scale proportionally by |rate|, and the last pool day
// takes the rounding remainder so the pool sums exactly. Days on or
// before the edited day are locked (an edit to Day 5 must never move
// Day 2). Editing Day 22 itself spreads the delta over the other
// unapplied days instead. Applied days are never touched.
function rebalanceTraderPlan(year, month, traderId, editedDay, editedRate) {
  const db = getMainDb();
  return db.transaction(() => {
    const all = db.prepare('SELECT * FROM trader_profit_schedule WHERE trader_id=? AND cycle_year=? AND cycle_month=? ORDER BY day_number').all(traderId, year, month);
    const planTotal = all.reduce((a, d) => a + d.rate_bp, 0);
    const orig = all.find(d => d.day_number === editedDay);
    if (!orig) throw new Error('Day not found in plan');
    const delta = editedRate - orig.rate_bp;
    db.prepare('UPDATE trader_profit_schedule SET rate_bp=? WHERE trader_id=? AND cycle_year=? AND cycle_month=? AND day_number=?').run(editedRate, traderId, year, month, editedDay);
    // Pool: unapplied days after the edited day. If the edited day IS
    // Day 22 there is no pool after it — use the other unapplied days.
    let pool = all.filter(d => d.applied === 0 && d.day_number > editedDay);
    if (editedDay === CYCLE_DAYS) pool = all.filter(d => d.applied === 0 && d.day_number !== CYCLE_DAYS);
    if (pool.length === 0) return; // nothing to rebalance; total may shift by delta
    const poolTotal = pool.reduce((a, d) => a + d.rate_bp, 0);
    const targetPool = poolTotal - delta;
    const rawSum = pool.reduce((a, d) => a + Math.abs(d.rate_bp), 0);
    let assigned = 0;
    for (let i = 0; i < pool.length; i++) {
      const d = pool[i];
      let nr;
      if (i === pool.length - 1) nr = targetPool - assigned;
      else { nr = rawSum > 0 ? Math.round(Math.abs(d.rate_bp) / rawSum * targetPool) : Math.round(targetPool / pool.length); assigned += nr; }
      db.prepare('UPDATE trader_profit_schedule SET rate_bp=? WHERE id=?').run(nr, d.id);
    }
  })();
}

// Rebalance every trader's remaining (unapplied) days to a new global
// target (Money Settings target change). Each trader's plan total is
// scaled by newTarget/oldTarget, so a mid-month plan keeps its
// remaining-percent shape. Applied days stay exactly as they are;
// Day 22 (if unapplied) balances each trader's month.
function retargetTraderPlans(year, month, newTargetBp, oldTargetBp) {
  const db = getMainDb();
  const oldT = (oldTargetBp !== undefined && oldTargetBp !== null && oldTargetBp > 0) ? oldTargetBp : getTargetBp();
  return db.transaction(() => {
    const traders = db.prepare('SELECT DISTINCT trader_id FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=?').all(year, month).map(r => r.trader_id);
    for (const traderId of traders) {
      const all = db.prepare('SELECT * FROM trader_profit_schedule WHERE trader_id=? AND cycle_year=? AND cycle_month=? ORDER BY day_number').all(traderId, year, month);
      const remaining = all.filter(d => d.applied !== 1);
      if (!remaining.length) continue;
      const planTotal = all.reduce((a, d) => a + d.rate_bp, 0);
      const newPlanTotal = Math.round(planTotal * newTargetBp / oldT);
      const appliedSum = all.filter(d => d.applied === 1).reduce((a, d) => a + d.rate_bp, 0);
      const needed = newPlanTotal - appliedSum;
      const upd = db.prepare('UPDATE trader_profit_schedule SET rate_bp=?,is_loss=? WHERE id=?');
      const non22 = remaining.filter(d => d.day_number !== CYCLE_DAYS);
      const curSum = remaining.reduce((a, d) => a + d.rate_bp, 0);
      if (curSum !== 0) {
        const factor = needed / curSum;
        for (const d of non22) { const nr = Math.round(d.rate_bp * factor); upd.run(nr, nr < 0 ? 1 : 0, d.id); }
      } else {
        const per = remaining.length ? Math.round(needed / remaining.length) : 0;
        for (const d of non22) { upd.run(per, per < 0 ? 1 : 0, d.id); }
      }
      const d22 = remaining.find(d => d.day_number === CYCLE_DAYS);
      if (d22) {
        const others = db.prepare('SELECT * FROM trader_profit_schedule WHERE trader_id=? AND cycle_year=? AND cycle_month=?').all(traderId, year, month);
        const sumOthers = others.filter(d => d.day_number !== CYCLE_DAYS).reduce((a, d) => a + d.rate_bp, 0);
        const r22 = newPlanTotal - sumOthers;
        upd.run(r22, r22 < 0 ? 1 : 0, d22.id);
      }
    }
    return { changed: true };
  })();
}

// The month's plan rates for one trader, as a Map day -> rate (used by
// the Day-22 balancing, which needs the trader's whole month).
function planRatesByTrader(year, month) {
  const rows = getMainDb().prepare('SELECT trader_id, day_number, rate_bp FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY trader_id, day_number').all(year, month);
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.trader_id)) m.set(r.trader_id, []);
    m.get(r.trader_id).push(r);
  }
  return m;
}

// Showcase profit (v128): display-only profit for showcase accounts,
// on the SAME per-trader plans as real users (rates read from the MAIN
// DB). Each trader pays their own plan rate; a showcase user's own
// profit target (users.profit_target_bp in the showcase DB) scales it.
// Parts trickle 10 AM–7 PM (partTimes), each with its own daily_pnl_log
// row IN THE SHOWCASE DB ONLY + its own notification. No transactions,
// and the admin dashboard / ledgers read the MAIN DB only, so showcase
// money never appears there. Idempotent via daily_pnl_log (UNIQUE
// copy/day). Day 22 balances each copy to exactly its month target.
function applyShowcasePnl(db, yr, mo, day, opts) {
  const nowMin = (opts && opts.nowMin !== undefined) ? opts.nowMin : dhakaNowMin();
  const force = !!(opts && opts.force);
  const globalTarget = getTargetBp();
  const planRates = new Map(getMainDb().prepare('SELECT trader_id, rate_bp FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? AND day_number=?').all(yr, mo, day).map(r => [r.trader_id, r.rate_bp]));
  const planByTrader = planRatesByTrader(yr, mo);
  const users = db.prepare('SELECT id, showcase_copy_cents, profit_target_bp FROM users WHERE is_showcase=1 AND showcase_copy_cents>0').all();
  let cnt = 0, tot = 0, pending = 0, nextPartMin = null, allDone = true;
  const hasLog = db.prepare('SELECT id FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=? AND day_number=?');
  const paidSoFar = db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS t FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=?');
  const insLog = db.prepare('INSERT INTO daily_pnl_log (copy_id,user_id,trader_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?,?,?)');
  const updUser = db.prepare('UPDATE users SET showcase_profit_cents=showcase_profit_cents+? WHERE id=?');
  const updCopy = db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=?,cycle_day=cycle_day+1,updated_at=unixepoch() WHERE id=?');
  const insN = db.prepare("INSERT INTO notifications (user_id,title,message,type,action_url) VALUES (?,?,?,?,?)");
  for (const u of users) {
    const userTarget = (u.profit_target_bp !== null && u.profit_target_bp !== undefined) ? u.profit_target_bp : globalTarget;
    const copies = db.prepare("SELECT c.id, c.trader_id, c.amount_cents, c.cycle_start_date, t.name AS trader_name FROM copies c LEFT JOIN traders t ON c.trader_id=t.id WHERE c.user_id=? AND c.status='active' ORDER BY c.id").all(u.id);
    const payable = copies.filter(c => planRates.has(c.trader_id) && copyStartDay(c, yr, mo) <= day);
    if (!payable.length) continue;
    const times = partTimes(`${u.id}:${yr}:${mo}:${day}:showcase`, payable.length);
    let userDone = true;
    payable.forEach((c, i) => {
      if (hasLog.get(c.id, yr, mo, day)) return; // part already landed
      if (!force && nowMin < times[i]) { pending++; userDone = false; if (nextPartMin === null || times[i] < nextPartMin) nextPartMin = times[i]; return; }
      const rateBp = planRates.get(c.trader_id);
      const rateEff = globalTarget > 0 ? Math.round(rateBp * userTarget / globalTarget) : rateBp;
      let share;
      if (day === CYCLE_DAYS) {
        // Day 22 balances: pay exactly what remains to reach this copy's
        // month target (the trader's plan rates from the copy's start
        // day to Day 22, scaled by the user's target).
        const plan = planByTrader.get(c.trader_id) || [];
        const startDay = copyStartDay(c, yr, mo);
        const targetBp = plan.filter(r => r.day_number >= startDay).reduce((a, r) => a + r.rate_bp, 0);
        const targetBpEff = globalTarget > 0 ? Math.round(targetBp * userTarget / globalTarget) : targetBp;
        share = Math.round(c.amount_cents * targetBpEff / 10000) - paidSoFar.get(c.id, yr, mo).t;
      } else {
        share = Math.round(c.amount_cents * rateEff / 10000);
      }
      const rateBpCopy = c.amount_cents > 0 ? Math.round(share * 10000 / c.amount_cents) : 0;
      insLog.run(c.id, u.id, c.trader_id, yr, mo, day, rateBpCopy, share);
      updCopy.run(share, share, c.id);
      updUser.run(share, u.id);
      if (share !== 0) {
        const name = c.trader_name || 'Trader';
        if (share >= 0) insN.run(u.id, `Daily profit — Day ${day} of 22`, `${name}: +$${H.fmtC(share)} (${(rateBpCopy / 100).toFixed(2)}%) added to your Profit Balance.`, 'success', '/dashboard');
        else insN.run(u.id, `Daily loss — Day ${day} of 22`, `${name}: -$${H.fmtC(Math.abs(share))} (${(Math.abs(rateBpCopy) / 100).toFixed(2)}%) applied to your Profit Balance.`, 'warning', '/dashboard');
      }
      cnt++; tot += share;
    });
    if (!userDone) allDone = false;
  }
  return { count: cnt, totalApplied: tot, pending, nextPartMin, allApplied: allDone };
}

// True when a trader's day is fully paid: no active copy of theirs
// (real or showcase) lacks a daily_pnl_log row for the day, ignoring
// copies that start after today (they earn from their start day).
function traderDayDone(traderId, yr, mo, day) {
  for (const db of [getMainDb(), getShowcaseDb()]) {
    const copies = db.prepare("SELECT id, cycle_start_date FROM copies WHERE trader_id=? AND status='active'").all(traderId);
    for (const c of copies) {
      if (copyStartDay(c, yr, mo) > day) continue;
      const has = db.prepare('SELECT id FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=? AND day_number=?').get(c.id, yr, mo, day);
      if (!has) return false;
    }
  }
  return true;
}

// Applies one day's PnL under the per-trader plans: each active copy
// earns its trader's plan rate for the day (scaled by the user's own
// target when set), trickled 10 AM–7 PM, one part per copied trader.
// Each part writes its daily_pnl_log row, updates the copy + Profit
// Balance, writes a 'daily_pnl' transaction and sends its own
// notification. Day 22 balances each copy to exactly its month target.
// The trader plan rows for the day are marked applied only when every
// part for that trader (real + showcase) has landed. A single-user
// manual apply never touches showcase and never marks plan rows applied.
// opts.nowMin is minutes since midnight Dhaka (defaults to now);
// opts.force pays every part at once (the admin auto-run escape hatch).
// Returns {count, totalApplied, pending, allApplied, nextPartMin,
// dayTotalApplied, showcaseCount, showcaseTotalApplied}.
function applyDailyPnl(yr, mo, day, targetUserId, opts) {
  const db = getDb();
  const nowMin = (opts && opts.nowMin !== undefined) ? opts.nowMin : dhakaNowMin();
  const force = !!(opts && opts.force);
  return db.transaction(() => {
    const globalTarget = getTargetBp();
    const planRates = new Map(getMainDb().prepare('SELECT trader_id, rate_bp FROM trader_profit_schedule WHERE cycle_year=? AND cycle_month=? AND day_number=?').all(yr, mo, day).map(r => [r.trader_id, r.rate_bp]));
    const planByTrader = planRatesByTrader(yr, mo);
    // NOTE: the user filter must come BEFORE ORDER BY — appending it
    // after ORDER BY silently turns it into a sort key and applies to
    // EVERY user (a bug the old code had).
    let q = "SELECT c.*, u.profit_target_bp, t.name AS trader_name FROM copies c JOIN users u ON c.user_id=u.id JOIN traders t ON c.trader_id=t.id WHERE c.status='active' AND u.is_showcase=0";
    const p = []; if (targetUserId) { q += ' AND c.user_id=?'; p.push(targetUserId); }
    q += ' ORDER BY c.id';
    const copies = db.prepare(q).all(...p);
    let cnt = 0, tot = 0, pending = 0, nextPartMin = null;
    const hasLog = db.prepare('SELECT id FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=? AND day_number=?');
    const paidSoFar = db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS t FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=?');
    const insN = db.prepare("INSERT INTO notifications (user_id,title,message,type,action_url) VALUES (?,?,?,?,?)");
    const byUser = new Map();
    for (const copy of copies) {
      if (!byUser.has(copy.user_id)) byUser.set(copy.user_id, []);
      byUser.get(copy.user_id).push(copy);
    }
    for (const [uid, userCopies] of byUser) {
      const first = userCopies[0];
      const userTarget = (first.profit_target_bp !== null && first.profit_target_bp !== undefined) ? first.profit_target_bp : globalTarget;
      const payable = userCopies.filter(c => planRates.has(c.trader_id) && copyStartDay(c, yr, mo) <= day);
      if (!payable.length) continue;
      const times = partTimes(`${uid}:${yr}:${mo}:${day}`, payable.length);
      payable.forEach((copy, i) => {
        if (hasLog.get(copy.id, yr, mo, day)) return; // already paid — idempotent
        if (!force && nowMin < times[i]) { pending++; if (nextPartMin === null || times[i] < nextPartMin) nextPartMin = times[i]; return; }
        const rateBp = planRates.get(copy.trader_id);
        const rateEff = globalTarget > 0 ? Math.round(rateBp * userTarget / globalTarget) : rateBp;
        let ac;
        if (day === CYCLE_DAYS) {
          const plan = planByTrader.get(copy.trader_id) || [];
          const startDay = copyStartDay(copy, yr, mo);
          const targetBp = plan.filter(r => r.day_number >= startDay).reduce((a, r) => a + r.rate_bp, 0);
          const targetBpEff = globalTarget > 0 ? Math.round(targetBp * userTarget / globalTarget) : targetBp;
          ac = Math.round(copy.amount_cents * targetBpEff / 10000) - paidSoFar.get(copy.id, yr, mo).t;
        } else {
          ac = Math.round(copy.amount_cents * rateEff / 10000);
        }
        const rateBpCopy = copy.amount_cents > 0 ? Math.round(ac * 10000 / copy.amount_cents) : 0;
        db.prepare('INSERT INTO daily_pnl_log (copy_id,user_id,trader_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?,?,?)')
          .run(copy.id, copy.user_id, copy.trader_id, yr, mo, day, rateBpCopy, ac);
        db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=?,cycle_day=cycle_day+1,updated_at=unixepoch() WHERE id=?')
          .run(ac, ac, copy.id);
        db.prepare('UPDATE balances SET profit_cents=profit_cents+?,updated_at=unixepoch() WHERE user_id=?').run(ac, copy.user_id);
        db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
          .run(copy.user_id, 'daily_pnl', Math.abs(ac), Math.abs(ac), ac >= 0 ? 'in' : 'out', 'completed',
            `Daily PnL — Day ${day} of 22`,
            `Profit ${ac >= 0 ? '+=' : '-='} ${Math.abs(rateBpCopy) / 100}% x $${H.fmtC(copy.amount_cents)} = $${H.fmtC(Math.abs(ac))}${ac < 0 ? ' (loss)' : ''}`);
        if (ac !== 0) {
          if (ac >= 0) insN.run(copy.user_id, `Daily profit — Day ${day} of 22`, `${copy.trader_name}: +$${H.fmtC(ac)} (${(rateBpCopy / 100).toFixed(2)}%) added to your Profit Balance.`, 'success', '/dashboard');
          else insN.run(copy.user_id, `Daily loss — Day ${day} of 22`, `${copy.trader_name}: -$${H.fmtC(Math.abs(ac))} (${(Math.abs(rateBpCopy) / 100).toFixed(2)}%) applied to your Profit Balance.`, 'warning', '/dashboard');
        }
        cnt++; tot += ac;
      });
    }
    // Showcase accounts earn the same per-trader plans on their DISPLAY
    // copy balance (showcase DB, separate file) — trickled on every
    // tick, same as real users. A single-user manual apply never
    // touches showcase.
    let sc = { count: 0, totalApplied: 0, pending: 0, nextPartMin: null, allApplied: true };
    if (!targetUserId) {
      try { sc = applyShowcasePnl(getShowcaseDb(), yr, mo, day, { nowMin, force }); }
      catch (e) { console.error('[profit] showcase apply failed:', e.message); }
    }
    // The day is done only when every trader's plan row for the day is
    // fully paid (real + showcase). Until then the rows stay unapplied
    // so later ticks keep paying the remaining parts.
    let allApplied = true;
    if (!targetUserId) {
      for (const traderId of planRates.keys()) {
        if (traderDayDone(traderId, yr, mo, day)) {
          getMainDb().prepare('UPDATE trader_profit_schedule SET applied=1,applied_at=unixepoch() WHERE trader_id=? AND cycle_year=? AND cycle_month=? AND day_number=?').run(traderId, yr, mo, day);
        } else {
          allApplied = false;
        }
      }
    } else {
      const leftQ = "SELECT COUNT(*) AS n FROM copies c JOIN users u ON c.user_id=u.id WHERE c.status='active' AND u.is_showcase=0 AND c.user_id=? AND NOT EXISTS (SELECT 1 FROM daily_pnl_log d WHERE d.copy_id=c.id AND d.cycle_year=? AND d.cycle_month=? AND d.day_number=?)";
      allApplied = db.prepare(leftQ).get(targetUserId, yr, mo, day).n === 0;
    }
    let dayTotalApplied = null;
    if (allApplied && !targetUserId) {
      dayTotalApplied = db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS t FROM daily_pnl_log WHERE cycle_year=? AND cycle_month=? AND day_number=?').get(yr, mo, day).t;
    }
    const nextMin = nextPartMin === null ? sc.nextPartMin : (sc.nextPartMin === null ? nextPartMin : Math.min(nextPartMin, sc.nextPartMin));
    return { count: cnt, totalApplied: tot, pending: pending + sc.pending, allApplied, nextPartMin: nextMin, dayTotalApplied, showcaseCount: sc.count, showcaseTotalApplied: sc.totalApplied };
  })();
}

module.exports = {
  getTargetBp, variedSplit, partTimes, dhakaNowMin, TRICKLE_START_MIN, TRICKLE_END_MIN,
  formatMinutes, formatTrickleWindow, formatDayRunTime,
  buildPlanRates, generateTraderPlan, generateTraderPlans, getPlannableTraders,
  getTraderPlans, getTraderPlan, traderPlansExist, currentCycleDay, globalNextDay,
  copyStartDay, rebalanceTraderPlan, retargetTraderPlans,
  applyDailyPnl, applyShowcasePnl,
};
