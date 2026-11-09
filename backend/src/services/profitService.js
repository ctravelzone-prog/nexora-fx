// services/profitService.js — 22-day profit cycle: schedule + daily apply.
// The profit target (default 10%) is spread over 22 weekdays of a month
// (Sat/Sun skipped). generateSchedule makes varied daily rates with 2-3
// loss days (never Day 1 or Day 22); Day 22 is the balancing day, set to
// whatever remains so the month lands exactly on the target — target
// wording, never a guarantee. applyDailyPnl applies one day to every
// active copy (and to showcase display balances, via applyShowcasePnl).
// Times: each month the 22 slots 12:00 PM-7:00 PM (20-min steps) are
// SHUFFLED like the rates and stored per day (run_minutes) — kept as a
// legacy per-day anchor. What actually pays a user is the TRICKLE
// (owner, 7 Nov): one part per copied trader, each part landing at its
// own time between 10:00 AM and 7:00 PM Dhaka, so the day total is fully
// added by 7:00 PM and the Trade History shows different times per
// trader instead of one identical timestamp for the whole day.
// Part times are deterministic per (user, cycle, day, copy) —
// partTimes() below — so every scheduler tick agrees on them, and the
// per-copy shares are computed once over the user's FULL active copy
// set (including already-paid parts), so the day total stays exactly
// the uniform total even when parts land on different ticks.
// A per-user profit target scales that user's rates. All money is
// integer cents; the profit goes to Copy Invested only, on the first
// copied amount, no compounding.
const { getDb, getShowcaseDb } = require('../models/database');
const H = require('./moneyHelpers');

// Global cycle target in basis points (100 = 1%). Admin sets it in Money Settings.
function getTargetBp() { const v = parseInt(H.getSetting('profit_target_bp','1000')); return Number.isFinite(v) && v >= 0 ? v : 1000; }

// Per-trader variation for the daily PnL split (owner, 7 Nov): when a user
// copies several traders, every trader showing the exact same rate looked
// artificial. So the day's schedule rate is the user's TOTAL for the day,
// and each copy earns a slightly different rate — same sign, a
// deterministic 0.7x-1.3x factor per (user, cycle, day, copy) — so every
// day looks different for every trader, 22 days 22 ways. The factors are
// normalized so the amount-weighted average is exactly 1, and the shares
// sum exactly to the uniform day total (remainder on the largest copy),
// so the day total, the 22-day target and every notification are
// unchanged — only the per-trader split varies.
function _hashSeed(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function _mulberry32(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
// Splits a day total (cents, may be negative) across copy amounts with
// per-trader variation. Returns integer amounts summing exactly to total.
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

// Profit time cycle (owner, 6 Nov): the daily profit no longer lands at a
// fixed 12:00 PM. Each month, the 22 time slots 12:00 PM-7:00 PM (20-min
// steps) are SHUFFLED — like the rates — and stored per day in
// profit_schedule.run_minutes (minutes since midnight Dhaka). So every
// month each day pays at a different time, and the next month's mapping
// is a fresh shuffle. Regenerating a month's schedule re-shuffles its
// times too. Rows made before this change have NULL run_minutes and fall
// back to the fixed formula (Day N = 12:00 PM + (N-1) x 20 min).
const CYCLE_START_MIN = 12 * 60; // 12:00 PM Dhaka
const CYCLE_STEP_MIN = 20;
const CYCLE_DAYS = 22;
function timeSlots() {
  const slots = [];
  for (let m = CYCLE_START_MIN; m <= CYCLE_START_MIN + (CYCLE_DAYS - 1) * CYCLE_STEP_MIN; m += CYCLE_STEP_MIN) slots.push(m);
  return slots;
}
function shuffleTimes() {
  const slots = timeSlots();
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  return slots;
}
function formatMinutes(mins) {
  const hour = Math.floor(mins / 60), minute = mins % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
// Fallback for pre-change rows (NULL run_minutes).
function profitTimeForDay(dayNumber) {
  const mins = CYCLE_START_MIN + (dayNumber - 1) * CYCLE_STEP_MIN;
  return { hour: Math.floor(mins / 60), minute: mins % 60 };
}
function formatProfitTime(dayNumber) { return formatMinutes(CYCLE_START_MIN + (dayNumber - 1) * CYCLE_STEP_MIN); }
// The {hour, minute} a schedule row pays at (stored shuffle, else fallback).
function dayRunTime(row) {
  if (row && row.run_minutes !== null && row.run_minutes !== undefined) {
    return { hour: Math.floor(row.run_minutes / 60), minute: row.run_minutes % 60 };
  }
  return profitTimeForDay(row ? row.day_number : 1);
}
// The day's payout window (display): parts land across it, not at one time.
function formatTrickleWindow() { return formatMinutes(TRICKLE_START_MIN) + ' – ' + formatMinutes(TRICKLE_END_MIN); }
function formatDayRunTime(row) {
  return formatTrickleWindow();
}
// Minutes since midnight (Dhaka) right now — the trickle clock.
function dhakaNowMin() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
}
// One payout time per copy, spread across the 10:00 AM-7:00 PM window.
// The window is split into copyCount equal slots, the slot order is
// shuffled deterministically from the seed (so which trader pays first
// differs per user and per day), and each time gets a small +/-10 min
// jitter so the times never look mechanical. Returns an array of
// minutes-since-midnight, index = the copy's index in its user's
// copy list (ORDER BY id, same as applyDailyPnl uses).
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

// Builds the month's 22 daily rates from the global target: 2 or 3 loss
// days (-20 to -40 bp, never Day 1 or Day 22), varied positive rates,
// and Day 22 set to the exact remainder so the month lands on the
// target. Replaces any existing schedule for the month.
function generateSchedule(year, month) {
  const db = getDb();
  const TARGET_BP = getTargetBp();
  db.prepare('DELETE FROM profit_schedule WHERE cycle_year=? AND cycle_month=?').run(year, month);
  const lossCount = Math.random() < 0.5 ? 2 : 3;
  const posCount = 22 - lossCount;
  const lossRates = Array.from({length:lossCount},()=>-(20+Math.floor(Math.random()*21)));
  const totalLossBp = lossRates.reduce((a,b)=>a+b,0);
  const totalPosBp = TARGET_BP - totalLossBp;
  const posRates = variedRates(posCount, totalPosBp);
  const lossPos = pickLossPos(22, lossCount);
  const days = [];
  let pi=0, li=0;
  for(let i=1;i<=22;i++){
    if(lossPos.includes(i)) days.push({day:i,rate:lossRates[li++],isLoss:1});
    else days.push({day:i,rate:posRates[pi++],isLoss:0});
  }
  const sumWithout22 = days.slice(0,21).reduce((a,r)=>a+r.rate,0);
  days[21].rate = TARGET_BP - sumWithout22;
  days[21].isLoss = days[21].rate < 0 ? 1 : 0;
  // Times: the 22 slots, freshly shuffled for this month.
  const times = shuffleTimes();
  days.forEach((d, idx) => { d.runMin = times[idx]; });
  const ins = db.prepare('INSERT INTO profit_schedule (cycle_year,cycle_month,day_number,rate_bp,is_loss,run_minutes) VALUES (?,?,?,?,?,?)');
  db.transaction(rows=>{ for(const r of rows) ins.run(year,month,r.day,r.rate,r.isLoss,r.runMin); })(days);
  return days;
}

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

// Returns the month's schedule rows ordered by day number (empty when
// the month has no schedule yet).
function getSchedule(year, month) {
  return getDb().prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
}

// Showcase profit: display-only profit for showcase accounts, 10% target over the
// same 22-day schedule, computed on the DISPLAY copy balance (showcase_copy_cents)
// and added to the DISPLAY profit (showcase_profit_cents). It TRICKLES exactly
// like real users — one part per copied trader, each at its own time in the
// 10:00 AM–7:00 PM Dhaka window (partTimes), a different rate per trader
// (variedSplit 0.7x-1.3x), and every landed part writes a daily_pnl_log row
// IN THE SHOWCASE DB ONLY, so the showcase user's Trade History shows it,
// PLUS its own notification the moment it lands (same message as real
// users — the live-push poller and the bell read the showcase DB too).
// Still no transactions, and the admin dashboard / ledgers read the MAIN
// DB only, so showcase money never appears there. Idempotent: a landed
// part is skipped via daily_pnl_log (UNIQUE copy/day); the
// showcase_profit_log row is written only when the user's whole day has
// landed. Runs on every scheduler tick (opts.nowMin/force, same as
// applyDailyPnl); a single-user manual apply never touches showcase.
// Already-credited day: when the showcase_profit_log row exists, the
// day's money was already credited in full (pre-v126 one-shot apply),
// so a missing part lands HISTORY + NOTIFICATION ONLY — never money
// again. That is what lets a wrongly backfilled future row be deleted
// and re-land at its real time without double-crediting.

// One-time Day-1 reset (owner, 9 Nov 2026): the Day-1 profit was credited
// wrongly at ~10 AM (the whole day at once, with future-dated history).
// At 1:00 PM on 9 Nov 2026 the scheduler removes it from the SHOWCASE DB
// (Profit Balance, per-copy profit, Trade History, day-log, notifications)
// and resets the main schedule Day 1 to unapplied, so the same Day-1
// profit re-adds fresh, part by part, from 1 PM. Runs exactly once
// (flag day1_reset_done in main site_settings). Safety: it only runs
// when the wrong Day-1 amounts are exactly as expected (siam 1785c,
// prince 2040c) — if they differ, it does nothing and reports why.
// Called from runAutoProfit on every weekday tick; the 1:00 PM gate
// (nowMin >= 780) and the flag make it a no-op at any other time.
function resetShowcaseDay1IfDue(nowMin, dhakaDateStr) {
  if (dhakaDateStr !== '2026-11-09' || nowMin < 780) return { done: false, reason: 'not_due' };
  if (H.getSetting('day1_reset_done', '') === '1') return { done: false, reason: 'already_done' };
  const sc = getShowcaseDb();
  const sums = sc.prepare('SELECT user_id, SUM(profit_cents) AS s FROM copies WHERE user_id IN (1,2) GROUP BY user_id').all();
  const s1 = (sums.find(r => r.user_id === 1) || {}).s;
  const s2 = (sums.find(r => r.user_id === 2) || {}).s;
  if (s1 !== 1785 || s2 !== 2040) return { done: false, reason: 'amounts_mismatch', s1, s2 };
  const db = getDb();
  sc.prepare('UPDATE users SET showcase_profit_cents = showcase_profit_cents - (SELECT COALESCE(SUM(profit_cents),0) FROM copies WHERE user_id=users.id) WHERE id IN (1,2)').run();
  sc.prepare('UPDATE copies SET profit_cents=0, daily_pnl_cents=0 WHERE user_id IN (1,2)').run();
  sc.prepare('DELETE FROM daily_pnl_log WHERE cycle_year=2026 AND cycle_month=11 AND day_number=1').run();
  sc.prepare('DELETE FROM showcase_profit_log WHERE cycle_year=2026 AND cycle_month=11 AND day_number=1').run();
  sc.prepare("DELETE FROM notifications WHERE title LIKE '%Day 1 of 22%'").run();
  db.prepare('UPDATE profit_schedule SET applied=0, applied_at=NULL WHERE cycle_year=2026 AND cycle_month=11 AND day_number=1').run();
  db.prepare("DELETE FROM site_settings WHERE key='auto_profit_last_date' AND value='2026-11-09'").run();
  db.prepare("INSERT INTO site_settings (key,value) VALUES ('day1_reset_done','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
  return { done: true, removedCents: 1785 + 2040 };
}

function applyShowcasePnl(db, rateBp, yr, mo, day, opts) {
  const nowMin = (opts && opts.nowMin !== undefined) ? opts.nowMin : dhakaNowMin();
  const force = !!(opts && opts.force);
  const users = db.prepare('SELECT id, showcase_copy_cents FROM users WHERE is_showcase=1 AND showcase_copy_cents>0').all();
  let cnt = 0, tot = 0, pending = 0, nextPartMin = null, allDone = true;
  const hasLog = db.prepare('SELECT id FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=? AND day_number=?');
  const hasDay = db.prepare('SELECT id FROM showcase_profit_log WHERE user_id=? AND cycle_year=? AND cycle_month=? AND day_number=?');
  const insLog = db.prepare('INSERT INTO daily_pnl_log (copy_id,user_id,trader_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?,?,?)');
  const insDay = db.prepare('INSERT INTO showcase_profit_log (user_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?)');
  const updUser = db.prepare('UPDATE users SET showcase_profit_cents=showcase_profit_cents+? WHERE id=?');
  const updCopy = db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=?,updated_at=unixepoch() WHERE id=?');
  const insN = db.prepare("INSERT INTO notifications (user_id,title,message,type,action_url) VALUES (?,?,?,?,?)");
  for (const u of users) {
    // Money already fully credited for this day (pre-v126 one-shot) —
    // missing parts still land, but history + notification only.
    const dayLogged = !!hasDay.get(u.id, yr, mo, day);
    const ac = Math.round((u.showcase_copy_cents || 0) * rateBp / 10000);
    const copies = db.prepare("SELECT c.id, c.trader_id, c.amount_cents, t.name AS trader_name FROM copies c LEFT JOIN traders t ON c.trader_id=t.id WHERE c.user_id=? AND c.status='active' ORDER BY c.id").all(u.id);
    const totCopy = copies.reduce((s, c) => s + c.amount_cents, 0);
    if (totCopy <= 0) continue;
    // Same deterministic split as before (same seed), so the day total and
    // the per-trader shares are unchanged — only the timing is new.
    const shares = variedSplit(`${u.id}:${yr}:${mo}:${day}:showcase`, copies.map(c=>c.amount_cents), ac);
    const times = partTimes(`${u.id}:${yr}:${mo}:${day}:showcase`, copies.length);
    let userDone = true;
    copies.forEach((c, i) => {
      if (hasLog.get(c.id, yr, mo, day)) return; // part already landed
      if (!force && nowMin < times[i]) { pending++; userDone = false; if (nextPartMin === null || times[i] < nextPartMin) nextPartMin = times[i]; return; }
      const share = shares[i];
      const rateBpCopy = c.amount_cents > 0 ? Math.round(share * 10000 / c.amount_cents) : 0;
      insLog.run(c.id, u.id, c.trader_id, yr, mo, day, rateBpCopy, share);
      if (!dayLogged) { // money not yet credited — credit it with the part
        updCopy.run(share, share, c.id);
        updUser.run(share, u.id);
      }
      if (share !== 0) {
        const name = c.trader_name || 'Trader';
        if (share >= 0) insN.run(u.id, `Daily profit — Day ${day} of 22`, `${name}: +$${H.fmtC(share)} (${(rateBpCopy / 100).toFixed(2)}%) added to your Profit Balance.`, 'success', '/dashboard');
        else insN.run(u.id, `Daily loss — Day ${day} of 22`, `${name}: -$${H.fmtC(Math.abs(share))} (${(Math.abs(rateBpCopy) / 100).toFixed(2)}%) applied to your Profit Balance.`, 'warning', '/dashboard');
      }
      cnt++; tot += share;
    });
    if (userDone && !dayLogged) insDay.run(u.id, yr, mo, day, rateBp, ac);
    else if (!userDone) allDone = false;
  }
  return { count: cnt, totalApplied: tot, pending, nextPartMin, allApplied: allDone };
}

// Applies one schedule day to every active copy: each copy earns rate%
// of its amount (scaled by the user's own target when set), the copy
// and the balance profit are updated, a daily_pnl_log row and a completed
// 'daily_pnl' transaction are written, and the schedule day is marked
// applied. Days already logged are skipped. Showcase accounts are handled
// separately (applyShowcasePnl) and only on a full apply — a single-user
// manual apply never touches showcase.
// Applies one day's PnL as a TRICKLE: one part per copied trader, each
// part landing at its own time in the 10:00 AM-7:00 PM window (see
// partTimes). A call applies only the parts whose time has come; the
// rest stay pending for a later tick. Each part sends its own
// notification the moment it lands (trader name + that part's amount
// and rate), so the user sees every part as it arrives. opts.nowMin is minutes since
// midnight Dhaka (defaults to now); opts.force pays every part at once
// (the admin auto-run escape hatch — a manual /apply does NOT force,
// so even a manual apply trickles across the day).
// Returns {count, totalApplied, pending, allApplied, nextPartMin,
// dayTotalApplied, showcaseCount, showcaseTotalApplied}. The schedule
// day is marked applied only when every part for the day has landed
// (so a partial call never blocks the remaining parts).
function applyDailyPnl(rateBp, yr, mo, day, targetUserId, opts) {
  const db = getDb();
  const nowMin = (opts && opts.nowMin !== undefined) ? opts.nowMin : dhakaNowMin();
  const force = !!(opts && opts.force);
  return db.transaction(()=>{
    let q="SELECT c.*, u.profit_target_bp, t.name AS trader_name FROM copies c JOIN users u ON c.user_id=u.id JOIN traders t ON c.trader_id=t.id WHERE c.status='active' AND u.is_showcase=0 ORDER BY c.id";
    const p=[]; if(targetUserId){q+=' AND c.user_id=?';p.push(targetUserId);}
    const copies=db.prepare(q).all(...p);
    let cnt=0,tot=0,pending=0,nextPartMin=null;
    const globalTarget=getTargetBp();
    const hasLog=db.prepare('SELECT id FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=? AND day_number=?');
    // Group ALL active copies by user — including already-paid ones:
    // the per-copy shares are computed once over the full set, so the
    // day total stays exactly the uniform total even when parts land
    // on different ticks (recomputing over only the unpaid copies
    // would drift the total).
    const byUser=new Map();
    for(const copy of copies){
      if(!byUser.has(copy.user_id)) byUser.set(copy.user_id,[]);
      byUser.get(copy.user_id).push(copy);
    }
    // Per-part notification: each part alerts on its own the moment it
    // lands, naming the trader and that part's amount + rate — so the
    // user sees exactly which trader paid what, instead of one total
    // at the end of the day.
    const insN=db.prepare("INSERT INTO notifications (user_id,title,message,type,action_url) VALUES (?,?,?,?,?)");
    for(const [uid,userCopies] of byUser){
      const first=userCopies[0];
      const userTarget=(first.profit_target_bp!==null&&first.profit_target_bp!==undefined)?first.profit_target_bp:globalTarget;
      const rateBpEff=globalTarget>0?Math.round(rateBp*userTarget/globalTarget):rateBp;
      // The day total is exactly what the uniform split would have paid;
      // variedSplit only re-slices it across this user's copies.
      const uniformTotal=userCopies.reduce((s,c)=>s+Math.round(c.amount_cents*rateBpEff/10000),0);
      const shares=variedSplit(`${uid}:${yr}:${mo}:${day}`,userCopies.map(c=>c.amount_cents),uniformTotal);
      const times=partTimes(`${uid}:${yr}:${mo}:${day}`,userCopies.length);
      userCopies.forEach((copy,i)=>{
        if(hasLog.get(copy.id,yr,mo,day)) return; // already paid — idempotent
        if(!force && nowMin < times[i]){ pending++; if(nextPartMin===null||times[i]<nextPartMin) nextPartMin=times[i]; return; }
        const ac=shares[i];
        const rateBpCopy=copy.amount_cents>0?Math.round(ac*10000/copy.amount_cents):0;
        db.prepare('INSERT INTO daily_pnl_log (copy_id,user_id,trader_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?,?,?)')
          .run(copy.id,copy.user_id,copy.trader_id,yr,mo,day,rateBpCopy,ac);
        db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=?,cycle_day=cycle_day+1,updated_at=unixepoch() WHERE id=?')
          .run(ac,ac,copy.id);
        db.prepare('UPDATE balances SET profit_cents=profit_cents+?,updated_at=unixepoch() WHERE user_id=?').run(ac,copy.user_id);
        db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
          .run(copy.user_id,'daily_pnl',Math.abs(ac),Math.abs(ac),ac>=0?'in':'out','completed',
            `Daily PnL — Day ${day} of 22`,
            `Profit ${ac>=0?'+=':'-='} ${Math.abs(rateBpCopy)/100}% x $${H.fmtC(copy.amount_cents)} = $${H.fmtC(Math.abs(ac))}${ac<0?' (loss)':''}`);
        if(ac!==0){
          if(ac>=0) insN.run(copy.user_id,`Daily profit — Day ${day} of 22`,`${copy.trader_name}: +$${H.fmtC(ac)} (${(rateBpCopy/100).toFixed(2)}%) added to your Profit Balance.`,'success','/dashboard');
          else insN.run(copy.user_id,`Daily loss — Day ${day} of 22`,`${copy.trader_name}: -$${H.fmtC(Math.abs(ac))} (${(Math.abs(rateBpCopy)/100).toFixed(2)}%) applied to your Profit Balance.`,'warning','/dashboard');
        }
        cnt++;tot+=ac;
      });
    }
    // The day is done only when no active real copy (in scope) is left
    // unpaid. Until then the schedule row stays unapplied so later ticks
    // keep paying the remaining parts.
    const leftQ=targetUserId
      ? "SELECT COUNT(*) AS n FROM copies c JOIN users u ON c.user_id=u.id WHERE c.status='active' AND u.is_showcase=0 AND c.user_id=? AND NOT EXISTS (SELECT 1 FROM daily_pnl_log d WHERE d.copy_id=c.id AND d.cycle_year=? AND d.cycle_month=? AND d.day_number=?)"
      : "SELECT COUNT(*) AS n FROM copies c JOIN users u ON c.user_id=u.id WHERE c.status='active' AND u.is_showcase=0 AND NOT EXISTS (SELECT 1 FROM daily_pnl_log d WHERE d.copy_id=c.id AND d.cycle_year=? AND d.cycle_month=? AND d.day_number=?)";
    const leftN=targetUserId?db.prepare(leftQ).get(targetUserId,yr,mo,day).n:db.prepare(leftQ).get(yr,mo,day).n;
    // Showcase accounts earn the same daily rate on their DISPLAY copy
    // balance (showcase DB, separate file) — trickled on every tick, same
    // as real users. A single-user manual apply never touches showcase.
    // The schedule day is done only when BOTH real and showcase parts
    // have all landed, so a partial showcase day never gets skipped.
    // (The old code called applyShowcasePnl with the MAIN db handle here,
    // which holds no showcase users — a no-op. The real showcase apply
    // lived in the callers; now it lives here, on every tick.)
    let sc = { count: 0, totalApplied: 0, pending: 0, nextPartMin: null, allApplied: true };
    if (!targetUserId) {
      try { sc = applyShowcasePnl(getShowcaseDb(), rateBp, yr, mo, day, { nowMin, force }); }
      catch (e) { console.error('[profit] showcase apply failed:', e.message); }
    }
    const allApplied = leftN===0 && sc.allApplied;
    let dayTotalApplied=null;
    if(allApplied){
      db.prepare('UPDATE profit_schedule SET applied=1,applied_at=unixepoch() WHERE cycle_year=? AND cycle_month=? AND day_number=?').run(yr,mo,day);
      dayTotalApplied=db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS t FROM daily_pnl_log WHERE cycle_year=? AND cycle_month=? AND day_number=?').get(yr,mo,day).t;
    }
    const nextMin = nextPartMin===null ? sc.nextPartMin : (sc.nextPartMin===null ? nextPartMin : Math.min(nextPartMin, sc.nextPartMin));
    return {count:cnt,totalApplied:tot,pending:pending+sc.pending,allApplied,nextPartMin:nextMin,dayTotalApplied,showcaseCount:sc.count,showcaseTotalApplied:sc.totalApplied};
  })();
}

// After an admin edits one day's rate: writes the edited rate, then
// re-spreads the remaining unapplied days (except Day 22) proportionally
// so the month still lands on the target; Day 22 (if unapplied) is set
// to the exact remainder. Applied days are never changed.
function rebalanceSchedule(year,month,editedDay,editedRate){
  const db=getDb();
  const TARGET_BP=getTargetBp();
  return db.transaction(()=>{
    db.prepare('UPDATE profit_schedule SET rate_bp=? WHERE cycle_year=? AND cycle_month=? AND day_number=?').run(editedRate,year,month,editedDay);
    const all=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
    const lockedSum=all.filter(d=>d.applied===1||d.day_number===editedDay).reduce((a,d)=>a+d.rate_bp,0);
    const rem=all.filter(d=>d.applied===0&&d.day_number!==editedDay&&d.day_number!==22);
    if(rem.length>0){
      const needed=TARGET_BP-lockedSum;
      const rawSum=rem.reduce((a,d)=>a+Math.abs(d.rate_bp),0);
      for(const d of rem){
        const nr=rawSum>0?Math.round(Math.abs(d.rate_bp)/rawSum*needed):Math.round(needed/rem.length);
        db.prepare('UPDATE profit_schedule SET rate_bp=? WHERE id=?').run(nr,d.id);
      }
    }
    const d22=all.find(d=>d.day_number===22);
    if(d22&&d22.applied===0){
      const updated=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
      const s22=updated.filter(d=>d.day_number!==22).reduce((a,d)=>a+d.rate_bp,0);
      db.prepare('UPDATE profit_schedule SET rate_bp=? WHERE cycle_year=? AND cycle_month=? AND day_number=22').run(TARGET_BP-s22,year,month);
    }
  })();
}

// Rebalance a month's remaining (unapplied) days to a new total target.
// Applied days stay exactly as they are; Day 22 (if unapplied) balances the month.
function retargetSchedule(year,month,newTargetBp){
  const db=getDb();
  return db.transaction(()=>{
    const all=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
    if(!all.length) return {changed:false,reason:'no_schedule'};
    const applied=all.filter(d=>d.applied===1);
    const remaining=all.filter(d=>d.applied!==1);
    if(!remaining.length) return {changed:false,reason:'all_applied'};
    const appliedSum=applied.reduce((a,d)=>a+d.rate_bp,0);
    const needed=newTargetBp-appliedSum;
    const curSum=remaining.reduce((a,d)=>a+d.rate_bp,0);
    const upd=db.prepare('UPDATE profit_schedule SET rate_bp=?,is_loss=? WHERE id=?');
    const non22=remaining.filter(d=>d.day_number!==22);
    if(curSum!==0){
      const factor=needed/curSum;
      for(const d of non22){const nr=Math.round(d.rate_bp*factor);upd.run(nr,nr<0?1:0,d.id);}
    }else{
      const per=remaining.length?Math.round(needed/remaining.length):0;
      for(const d of non22){upd.run(per,per<0?1:0,d.id);}
    }
    const d22=remaining.find(d=>d.day_number===22);
    if(d22){
      const others=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=?').all(year,month);
      const sumOthers=others.filter(d=>d.day_number!==22).reduce((a,d)=>a+d.rate_bp,0);
      const r22=newTargetBp-sumOthers;
      upd.run(r22,r22<0?1:0,d22.id);
    }
    return {changed:true};
  })();
}

module.exports = { generateSchedule, getSchedule, applyDailyPnl, applyShowcasePnl, resetShowcaseDay1IfDue, rebalanceSchedule, retargetSchedule, getTargetBp, profitTimeForDay, formatProfitTime, formatMinutes, dayRunTime, formatDayRunTime, formatTrickleWindow, partTimes, dhakaNowMin, TRICKLE_START_MIN, TRICKLE_END_MIN, timeSlots, variedSplit };
