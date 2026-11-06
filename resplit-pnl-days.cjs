// resplit-pnl-days.cjs — one-off data correction for the per-trader PnL
// variation (v82). Re-slices ALREADY-APPLIED days so each copy of a user
// shows a different rate, using the same deterministic variedSplit() the
// live code now uses for new days. The day TOTAL per user is preserved
// exactly (to the cent): no money is created or destroyed, balances are
// untouched, and each copy's profit only moves between that user's own
// copies. Usage: DB_PATH=/path/to/db node resplit-pnl-days.cjs 2026 11 1,6
// Prints a before/after report; runs inside one transaction per user/day.
// NEXORA_HOME points at the app root (default /root/nexora-fx on the VPS);
// DB_PATH must be set before running (the database module reads it).
const HOME = process.env.NEXORA_HOME || '/root/nexora-fx';
const { getDb } = require(`${HOME}/backend/src/models/database`);
const { variedSplit } = require(`${HOME}/backend/src/services/profitService`);

const [yr, mo, daysArg] = [parseInt(process.argv[2]), parseInt(process.argv[3]), process.argv[4]];
if (!yr || !mo || !daysArg) { console.error('usage: node resplit-pnl-days.cjs <year> <month> <day1,day2,...>'); process.exit(1); }
const days = daysArg.split(',').map(d => parseInt(d)).filter(Boolean);
const db = getDb();

for (const day of days) {
  const users = db.prepare('SELECT DISTINCT user_id FROM daily_pnl_log WHERE cycle_year=? AND cycle_month=? AND day_number=?').all(yr, mo, day);
  for (const { user_id: uid } of users) {
    const rows = db.prepare('SELECT l.id,l.copy_id,l.trader_id,l.rate_bp,l.amount_cents,c.amount_cents AS copy_amount FROM daily_pnl_log l JOIN copies c ON c.id=l.copy_id WHERE l.user_id=? AND l.cycle_year=? AND l.cycle_month=? AND l.day_number=? ORDER BY l.copy_id').all(uid, yr, mo, day);
    if (!rows.length) continue;
    const total = rows.reduce((s, r) => s + r.amount_cents, 0);
    const shares = variedSplit(`${uid}:${yr}:${mo}:${day}`, rows.map(r => r.copy_amount), total);
    const txRows = db.prepare("SELECT id,amount_cents FROM transactions WHERE user_id=? AND type='daily_pnl' AND reason=? ORDER BY id").all(uid, `Daily PnL — Day ${day} of 22`);
    if (txRows.length !== rows.length) { console.log(`Day ${day} user ${uid}: SKIP — ${txRows.length} tx rows vs ${rows.length} log rows`); continue; }
    db.transaction(() => {
      rows.forEach((r, i) => {
        const share = shares[i];
        const newRate = r.copy_amount > 0 ? Math.round(share * 10000 / r.copy_amount) : 0;
        db.prepare('UPDATE daily_pnl_log SET rate_bp=?,amount_cents=? WHERE id=?').run(newRate, share, r.id);
        const latestDay = db.prepare('SELECT MAX(day_number) AS m FROM daily_pnl_log WHERE copy_id=?').get(r.copy_id).m;
        if (latestDay === day) db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=? WHERE id=?').run(share - r.amount_cents, share, r.copy_id);
        else db.prepare('UPDATE copies SET profit_cents=profit_cents+? WHERE id=?').run(share - r.amount_cents, r.copy_id);
        const tx = txRows[i];
        db.prepare('UPDATE transactions SET amount_cents=?,net_cents=?,direction=?,formula=? WHERE id=?')
          .run(Math.abs(share), Math.abs(share), share >= 0 ? 'in' : 'out',
            `Profit ${share >= 0 ? '+=' : '-='} ${Math.abs(newRate) / 100}% x $${(r.copy_amount / 100).toFixed(2)} = $${(Math.abs(share) / 100).toFixed(2)}${share < 0 ? ' (loss)' : ''}`, tx.id);
      });
    })();
    const before = rows.map(r => `${r.trader_id}:${r.rate_bp}bp/$${(r.amount_cents / 100).toFixed(2)}`).join(' ');
    const after = rows.map((r, i) => `${r.trader_id}:${r.copy_amount > 0 ? Math.round(shares[i] * 10000 / r.copy_amount) : 0}bp/$${(shares[i] / 100).toFixed(2)}`).join(' ');
    console.log(`Day ${day} user ${uid}: total $${(total / 100).toFixed(2)} unchanged | before [${before}] | after [${after}]`);
  }
}
console.log('DONE');
