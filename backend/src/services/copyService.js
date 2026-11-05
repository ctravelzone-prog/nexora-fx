// copyService.js — copy start/increase/decrease/stop
const { getDb } = require('../models/database');
const H = require('./moneyHelpers');

function startCopy(userId, traderId, amountCents) {
  const db = getDb();
  return db.transaction(() => {
    const bal = H.getOrCreateBalance(userId);
    if (bal.main_cents < amountCents) throw new Error('Insufficient Main Balance');
    const t = db.prepare('SELECT * FROM traders WHERE id=? AND is_hidden=0').get(traderId);
    if (!t) throw new Error('Trader not found');
    if (amountCents < t.min_copy_cents) throw new Error(`Minimum copy is $${H.fmtC(t.min_copy_cents)}`);
    const ex = db.prepare(`SELECT * FROM copies WHERE user_id=? AND trader_id=? AND status='active'`).get(userId, traderId);
    let copyId;
    if (ex) {
      db.prepare('UPDATE copies SET amount_cents=amount_cents+?,updated_at=unixepoch() WHERE id=?').run(amountCents, ex.id);
      copyId = ex.id;
    } else {
      copyId = db.prepare('INSERT INTO copies (user_id,trader_id,amount_cents,cycle_start_date,cycle_day) VALUES (?,?,?,?,0)')
        .run(userId, traderId, amountCents, new Date().toISOString().split('T')[0]).lastInsertRowid;
      db.prepare('UPDATE traders SET followers=followers+1 WHERE id=?').run(traderId);
    }
    db.prepare('UPDATE balances SET main_cents=main_cents-?,copy_cents=copy_cents+?,updated_at=unixepoch() WHERE user_id=?').run(amountCents, amountCents, userId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
      .run(userId, 'copy_start', amountCents, amountCents, 'out', 'completed', `Copy started — ${t.name}`, `Main -= $${H.fmtC(amountCents)} to Copy Invested`);
    return copyId;
  })();
}

function increaseCopy(userId, copyId, addCents) {
  const db = getDb();
  return db.transaction(() => {
    if (H.getOrCreateBalance(userId).main_cents < addCents) throw new Error('Insufficient Main Balance');
    if (addCents <= 0) throw new Error('Amount must be positive');
    if (!db.prepare(`SELECT id FROM copies WHERE id=? AND user_id=? AND status='active'`).get(copyId, userId)) throw new Error('Active copy not found');
    db.prepare('UPDATE copies SET amount_cents=amount_cents+?,updated_at=unixepoch() WHERE id=?').run(addCents, copyId);
    db.prepare('UPDATE balances SET main_cents=main_cents-?,copy_cents=copy_cents+?,updated_at=unixepoch() WHERE user_id=?').run(addCents, addCents, userId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
      .run(userId, 'copy_increase', addCents, addCents, 'out', 'completed', 'Copy increase', `Main -= $${H.fmtC(addCents)} to Copy Invested`);
  })();
}

function decreaseCopy(userId, copyId, r) {
  const db = getDb();
  return db.transaction(() => {
    const copy = db.prepare(`SELECT * FROM copies WHERE id=? AND user_id=? AND status='active'`).get(copyId, userId);
    if (!copy) throw new Error('Active copy not found');
    if (r > copy.amount_cents) throw new Error('Cannot decrease below zero');
    if (r <= 0) throw new Error('Amount must be positive');
    db.prepare('UPDATE copies SET amount_cents=amount_cents-?,updated_at=unixepoch() WHERE id=?').run(r, copyId);
    db.prepare('UPDATE balances SET main_cents=main_cents+?,copy_cents=copy_cents-?,updated_at=unixepoch() WHERE user_id=?').run(r, r, userId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
      .run(userId, 'copy_decrease', r, r, 'in', 'completed', 'Copy decrease', `Copy -= $${H.fmtC(r)} returned to Main`);
  })();
}

function stopCopy(userId, copyId) {
  const db = getDb();
  return db.transaction(() => {
    const c = db.prepare(`SELECT * FROM copies WHERE id=? AND user_id=? AND status='active'`).get(copyId, userId);
    if (!c) throw new Error('Active copy not found');
    const tot = c.amount_cents + c.profit_cents;
    db.prepare(`UPDATE copies SET status='stopped',daily_pnl_cents=0,stopped_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(copyId);
    db.prepare('UPDATE balances SET main_cents=main_cents+?,copy_cents=copy_cents-?,profit_cents=profit_cents-?,updated_at=unixepoch() WHERE user_id=?')
      .run(tot, c.amount_cents, c.profit_cents, userId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
      .run(userId, 'copy_stop', tot, tot, 'in', 'completed', 'Copy stopped — today PnL $0.00',
        `Main += $${H.fmtC(c.amount_cents)} principal + $${H.fmtC(c.profit_cents)} profit; today PnL=$0.00`);
    const trader = db.prepare('SELECT * FROM traders WHERE id=?').get(c.trader_id);
    if (trader && trader.followers > 0) db.prepare('UPDATE traders SET followers=followers-1 WHERE id=?').run(c.trader_id);
    return { principal: c.amount_cents, profit: c.profit_cents, total: tot };
  })();
}

module.exports = { startCopy, increaseCopy, decreaseCopy, stopCopy };
