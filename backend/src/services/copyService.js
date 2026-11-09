// services/copyService.js — copy start/increase/decrease/stop.
// Moves money between Main Balance and Copy Invested and tracks each
// copy's earned profit. startCopy checks the trader minimum and the Main
// Balance, then creates the copy row; increaseCopy adds money to an active
// copy; decreaseCopy returns money to Main; stopCopy returns ONLY the
// principal to Main and marks the copy stopped — the earned profit STAYS
// in Profit Balance (Total PnL), taken out only via Profit Withdraw
// (v128 rule, owner 9 Nov 2026). settleTraderCopies settles every active
// copy of one trader with the same rule (trader removal).
// Rule: profit is earned only on Copy Invested, on the first copied
// amount, no compounding. Showcase accounts (is_showcase=1) cannot log
// in, so the showcase display-balance path below is unreachable legacy
// code — showcase $ must never appear in admin totals or ledgers.
const { getDb } = require('../models/database');
const H = require('./moneyHelpers');

// Showcase (demo) accounts keep their money in DISPLAY fields on the users
// row (showcase_main_cents / showcase_copy_cents / showcase_profit_cents),
// never in the real balances table. (Unreachable now — showcase accounts
// live in the separate showcase DB and CAN copy — showcase $ must never
// appear in admin
// totals or ledgers.)
// True when the user is a showcase (demo) account.
function isShowcase(db, userId) {
  const u = db.prepare('SELECT is_showcase FROM users WHERE id=?').get(userId);
  return !!(u && u.is_showcase === 1);
}
// Moves money between a showcase account's display fields (never the
// real balances table); returns false when the move would go negative.
function moveShowcase(db, userId, dMain, dCopy, dProfit) {
  db.prepare('UPDATE users SET showcase_main_cents=showcase_main_cents+?,showcase_copy_cents=showcase_copy_cents+?,showcase_profit_cents=showcase_profit_cents+? WHERE id=?')
    .run(dMain, dCopy, dProfit, userId);
}

// Starts copying a trader: validates the trader, the amount and the
// Main Balance (or the display balance for showcase), creates the copy
// row (cycle starts today), and moves the amount Main -> Copy Invested.
function startCopy(userId, traderId, amountCents) {
  const db = getDb();
  return db.transaction(() => {
    const sc = isShowcase(db, userId);
    if (sc) {
      const u = db.prepare('SELECT showcase_main_cents FROM users WHERE id=?').get(userId);
      if ((u.showcase_main_cents || 0) < amountCents) throw new Error('Insufficient Main Balance');
    } else {
      const bal = H.getOrCreateBalance(userId);
      if (bal.main_cents < amountCents) throw new Error('Insufficient Main Balance');
    }
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
    if (sc) {
      moveShowcase(db, userId, -amountCents, amountCents, 0);
    } else {
      db.prepare('UPDATE balances SET main_cents=main_cents-?,copy_cents=copy_cents+?,updated_at=unixepoch() WHERE user_id=?').run(amountCents, amountCents, userId);
      db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
        .run(userId, 'copy_start', amountCents, amountCents, 'out', 'completed', `Copy started — ${t.name}`, `Main -= $${H.fmtC(amountCents)} to Copy Invested`);
    }
    return copyId;
  })();
}

// Adds money to an active copy (Main -> Copy Invested).
function increaseCopy(userId, copyId, addCents) {
  const db = getDb();
  return db.transaction(() => {
    const sc = isShowcase(db, userId);
    if (sc) {
      const u = db.prepare('SELECT showcase_main_cents FROM users WHERE id=?').get(userId);
      if ((u.showcase_main_cents || 0) < addCents) throw new Error('Insufficient Main Balance');
    } else if (H.getOrCreateBalance(userId).main_cents < addCents) throw new Error('Insufficient Main Balance');
    if (addCents <= 0) throw new Error('Amount must be positive');
    if (!db.prepare(`SELECT id FROM copies WHERE id=? AND user_id=? AND status='active'`).get(copyId, userId)) throw new Error('Active copy not found');
    db.prepare('UPDATE copies SET amount_cents=amount_cents+?,updated_at=unixepoch() WHERE id=?').run(addCents, copyId);
    if (sc) {
      moveShowcase(db, userId, -addCents, addCents, 0);
    } else {
      db.prepare('UPDATE balances SET main_cents=main_cents-?,copy_cents=copy_cents+?,updated_at=unixepoch() WHERE user_id=?').run(addCents, addCents, userId);
      db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
        .run(userId, 'copy_increase', addCents, addCents, 'out', 'completed', 'Copy increase', `Main -= $${H.fmtC(addCents)} to Copy Invested`);
    }
  })();
}

// Takes money out of an active copy (Copy Invested -> Main). A copy
// cannot be decreased below zero.
function decreaseCopy(userId, copyId, r) {
  const db = getDb();
  return db.transaction(() => {
    const sc = isShowcase(db, userId);
    const copy = db.prepare(`SELECT * FROM copies WHERE id=? AND user_id=? AND status='active'`).get(copyId, userId);
    if (!copy) throw new Error('Active copy not found');
    if (r > copy.amount_cents) throw new Error('Cannot decrease below zero');
    if (r <= 0) throw new Error('Amount must be positive');
    db.prepare('UPDATE copies SET amount_cents=amount_cents-?,updated_at=unixepoch() WHERE id=?').run(r, copyId);
    if (sc) {
      moveShowcase(db, userId, r, -r, 0);
    } else {
      db.prepare('UPDATE balances SET main_cents=main_cents+?,copy_cents=copy_cents-?,updated_at=unixepoch() WHERE user_id=?').run(r, r, userId);
      db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
        .run(userId, 'copy_decrease', r, r, 'in', 'completed', 'Copy decrease', `Copy -= $${H.fmtC(r)} returned to Main`);
    }
  })();
}

// Stops a copy: ONLY the copied principal returns to Main Balance;
// the earned profit STAYS in Profit Balance (Total PnL) — v128 rule
// (owner 9 Nov 2026). Profit is taken out only via Profit Withdraw
// (min $10, no fee). Same for showcase display balances.
function stopCopyInDb(db, userId, copyId) {
  return db.transaction(() => {
    const sc = isShowcase(db, userId);
    const c = db.prepare(`SELECT * FROM copies WHERE id=? AND user_id=? AND status='active'`).get(copyId, userId);
    if (!c) throw new Error('Active copy not found');
    const principal = c.amount_cents;
    db.prepare(`UPDATE copies SET status='stopped',daily_pnl_cents=0,stopped_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(copyId);
    if (sc) {
      moveShowcase(db, userId, principal, -principal, 0);
    } else {
      db.prepare('UPDATE balances SET main_cents=main_cents+?,copy_cents=copy_cents-?,updated_at=unixepoch() WHERE user_id=?')
        .run(principal, principal, userId);
      db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
        .run(userId, 'copy_stop', principal, principal, 'in', 'completed', 'Copy stopped — principal returned to Main; profit stays in Profit Balance',
          `Main += $${H.fmtC(principal)} principal; profit $${H.fmtC(c.profit_cents)} stays in Profit Balance; today PnL=$0.00`);
    }
    const trader = db.prepare('SELECT * FROM traders WHERE id=?').get(c.trader_id);
    if (trader && trader.followers > 0) db.prepare('UPDATE traders SET followers=followers-1 WHERE id=?').run(c.trader_id);
    return { principal: c.amount_cents, profit: c.profit_cents, total: principal };
  })();
}

// Stops a copy (main DB handle).
function stopCopy(userId, copyId) {
  return stopCopyInDb(getDb(), userId, copyId);
}

// Settles every active copy of one trader (admin trader removal):
// principal returns to Main, profit stays in Profit Balance (same rule
// as stopCopy). Runs on the given DB handle (main or showcase) and
// notifies each affected user. Returns {settled, totalPrincipal}.
function settleTraderCopies(db, traderId, traderName) {
  const copies = db.prepare(`SELECT id, user_id, amount_cents FROM copies WHERE trader_id=? AND status='active' ORDER BY id`).all(traderId);
  let settled = 0, totalPrincipal = 0;
  const insN = db.prepare("INSERT INTO notifications (user_id,title,message,type,action_url) VALUES (?,?,?,?,?)");
  for (const cp of copies) {
    const r = stopCopyInDb(db, cp.user_id, cp.id);
    totalPrincipal += r.principal;
    settled++;
    insN.run(cp.user_id, 'Trader removed — copy stopped', `${traderName || 'Trader'} was removed. Your $${H.fmtC(r.principal)} copy was returned to Main Balance; your $${H.fmtC(r.profit)} profit stays in Profit Balance.`, 'info', '/dashboard');
  }
  return { settled, totalPrincipal };
}

module.exports = { startCopy, increaseCopy, decreaseCopy, stopCopy, stopCopyInDb, settleTraderCopies };
