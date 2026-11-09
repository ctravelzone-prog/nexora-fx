// One-time backfill: Day 1 (Mon 9 Nov 2026) showcase Trade History rows.
//
// Before v126 the showcase day was applied all at once with NO
// daily_pnl_log rows, so Trade History was empty while Copy History
// showed the profit. v126 writes the rows as parts land — but Day 1
// already landed, so this script inserts its per-trader rows (same
// shares + part times the v126 trickle would have produced).
//
// It NEVER writes a future-dated row: only parts whose time has
// already passed are inserted. A part still in the future is SKIPPED
// (reported, not inserted) — it lands at its real time through the
// normal trickle, with its notification. Writing future rows was the
// v126 backfill bug: at 11:04 AM the history showed 1:22 PM, 3:47 PM
// and 5:43 PM entries that had not happened yet.
//
// It touches the SHOWCASE DB ONLY, inserts daily_pnl_log rows only, and
// never changes users/copies money (already correct) or the main DB.
// Idempotent (INSERT OR IGNORE on the UNIQUE copy/day constraint) —
// safe to re-run. Aborts when the recomputed shares do not match the
// logged day total, so it can never insert wrong rows.
//
// Usage (on the VPS):
//   cd /root/nexora-fx && DB_PATH=/root/nexora-data/nexora-fx.db \
//     node backend/scripts/backfill-showcase-day1.cjs
// DB_PATH must point at the MAIN db; the showcase db is derived the
// same way the app does (.db -> -showcase.db).
// BACKFILL_NOW_MIN (minutes since midnight Dhaka) overrides the clock
// for tests only.
const { getShowcaseDb } = require('../src/models/database');
const { variedSplit, partTimes, dhakaNowMin } = require('../src/services/profitService');

const YR = 2026, MO = 11, DAY = 1, DATE = 9; // Mon 9 Nov 2026, cycle Day 1
// Dhaka is UTC+6 (no DST): epoch seconds for a Dhaka HH:MM on that date.
const dhakaEpoch = (min) => Math.floor(Date.UTC(YR, MO - 1, DATE, Math.floor(min / 60) - 6, min % 60) / 1000);

function main() {
  if (!process.env.DB_PATH) { console.error('DB_PATH env required (main db path)'); process.exit(2); }
  const db = getShowcaseDb();
  const users = db.prepare(
    'SELECT u.id, u.showcase_copy_cents, s.amount_cents AS day_total FROM users u ' +
    'JOIN showcase_profit_log s ON s.user_id=u.id AND s.cycle_year=? AND s.cycle_month=? AND s.day_number=? ' +
    'WHERE u.is_showcase=1 AND u.showcase_copy_cents>0'
  ).all(YR, MO, DAY);
  if (!users.length) { console.log('No showcase Day 1 log found — nothing to backfill.'); return; }
  // Only parts whose time has already passed may be backfilled.
  const nowMin = process.env.BACKFILL_NOW_MIN ? parseInt(process.env.BACKFILL_NOW_MIN, 10) : dhakaNowMin();
  let inserted = 0, skipped = 0, future = 0;
  for (const u of users) {
    const copies = db.prepare("SELECT id, trader_id, amount_cents FROM copies WHERE user_id=? AND status='active' ORDER BY id").all(u.id);
    const totCopy = copies.reduce((s, c) => s + c.amount_cents, 0);
    if (!totCopy) { console.log(`user ${u.id}: no active copies, skip`); continue; }
    const shares = variedSplit(`${u.id}:${YR}:${MO}:${DAY}:showcase`, copies.map(c => c.amount_cents), u.day_total);
    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum !== u.day_total) { console.error(`user ${u.id}: recomputed shares sum ${sum} != logged day total ${u.day_total} — ABORT, no rows written`); process.exit(3); }
    const times = partTimes(`${u.id}:${YR}:${MO}:${DAY}:showcase`, copies.length);
    const ins = db.prepare('INSERT OR IGNORE INTO daily_pnl_log (copy_id,user_id,trader_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents,applied_at) VALUES (?,?,?,?,?,?,?,?,?)');
    copies.forEach((c, i) => {
      if (times[i] > nowMin) { // not happened yet — the trickle lands it live
        future++;
        console.log(`skipped (future): copy ${c.id} trader ${c.trader_id} at ${String(Math.floor(times[i] / 60)).padStart(2, '0')}:${String(times[i] % 60).padStart(2, '0')} Dhaka — lands live via the trickle`);
        return;
      }
      const share = shares[i];
      const rateBpCopy = c.amount_cents > 0 ? Math.round(share * 10000 / c.amount_cents) : 0;
      const r = ins.run(c.id, u.id, c.trader_id, YR, MO, DAY, rateBpCopy, share, dhakaEpoch(times[i]));
      if (r.changes > 0) {
        inserted++;
        console.log(`inserted: copy ${c.id} trader ${c.trader_id} $${(share / 100).toFixed(2)} (${(rateBpCopy / 100).toFixed(2)}%) at ${String(Math.floor(times[i] / 60)).padStart(2, '0')}:${String(times[i] % 60).padStart(2, '0')} Dhaka`);
      } else skipped++;
    });
  }
  console.log(`done: ${inserted} inserted, ${skipped} already present, ${future} future (land live via the trickle)`);
}
main();
