// services/withdrawService.js — withdraw requests: create, approve, reject.
// requestMainWithdraw / requestProfitWithdraw: create a pending withdrawal
// row, deduct the amount (plus the Main fee) from the balance immediately,
// write the History row and notify the admin. processWithdrawal: the admin
// approves or rejects a pending withdrawal. adminAddBalance: the admin
// credits a user's Main or Profit Balance (with an audit log entry).
// Rules: withdraw from Main only; profit withdrawals need a $10 minimum
// and carry no fee. The wallet address must start with 0x.
const { getDb, getMainDb } = require('../models/database');
const H = require('./moneyHelpers');
const { confirmAddress } = require('./autoPayments');

// Creates a Main withdrawal request: computes the fee (early 15% inside
// the 3-month lock, otherwise the regular fee), refuses when Main cannot
// cover amount + fee, then deducts amount + fee from Main, writes the
// withdrawal + pending History rows, and notifies the admin.
function requestMainWithdraw(userId, amountCents, walletAddress) {
  const db = getDb(), s = H.getMoneySettings();
  const u0 = db.prepare('SELECT is_showcase, showcase_main_cents FROM users WHERE id=?').get(userId);
  const isSc = !!(u0 && u0.is_showcase === 1);
  return db.transaction(() => {
    if (isSc) {
      if (amountCents <= 0) throw new Error('Amount must be positive');
      if ((u0.showcase_main_cents || 0) < amountCents) throw new Error('Insufficient Main Balance');
    } else {
      const bal = H.getOrCreateBalance(userId);
      if (bal.main_cents < amountCents) throw new Error('Insufficient Main Balance');
      if (amountCents <= 0) throw new Error('Amount must be positive');
      // Main withdrawal cap (v122): a Main withdrawal can never exceed
      // the user's total deposited (lifetime). Profit leaves through the
      // Profit Balance (Total PnL), not through Main.
      if (amountCents > (bal.total_deposited_cents || 0)) throw new Error(`Main withdrawal cannot exceed your total deposited amount ($${H.fmtC(bal.total_deposited_cents || 0)})`);
    }
    const feeCents = H.calcMainWithdrawFee(userId, amountCents, s);
    const netCents = amountCents - feeCents;
    if (isSc) db.prepare('UPDATE users SET showcase_main_cents=showcase_main_cents-? WHERE id=?').run(amountCents, userId);
    else db.prepare('UPDATE balances SET main_cents=main_cents-?,updated_at=unixepoch() WHERE user_id=?').run(amountCents, userId);
    const wId = db.prepare(`INSERT INTO withdrawals (user_id,type,amount_cents,fee_cents,net_cents,wallet_address,method,status) VALUES (?,'main',?,?,?,?,'USDT BEP20','pending')`)
      .run(userId, amountCents, feeCents, netCents, walletAddress).lastInsertRowid;
    const feeStr = feeCents > 0 ? `fee ${H.getWithdrawFeeBp(userId,s)/100}% = $${H.fmtC(feeCents)}` : 'fee $0';
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(userId, 'withdraw_main', amountCents, feeCents, netCents, 'out', 'pending', `WD-${wId}`,
        'Main withdraw — pending approval', `Main -= $${H.fmtC(amountCents)}; ${feeStr}; net $${H.fmtC(netCents)}`);
    H.createAdminNotif(getMainDb(), 'withdraw', `Main withdraw request $${H.fmtC(amountCents)}`, wId, isSc ? 'showcase_withdrawal' : 'withdrawal', 'withdrawals');
    return { wId, feeCents, netCents };
  })();
}

// Creates a Profit withdrawal request: same flow as Main, but no fee
// and a $10 minimum. Refused when the amount is below the minimum or
// above the Profit Balance.
function requestProfitWithdraw(userId, amountCents, walletAddress) {
  const db = getDb(), s = H.getMoneySettings();
  const u0 = db.prepare('SELECT is_showcase, showcase_profit_cents FROM users WHERE id=?').get(userId);
  const isSc = !!(u0 && u0.is_showcase === 1);
  return db.transaction(() => {
    if (isSc) {
      if ((u0.showcase_profit_cents || 0) < s.profitMinCents)
        throw new Error(`Profit Balance must be at least $${H.fmtC(s.profitMinCents)} to withdraw`);
      if (amountCents < s.profitMinCents) throw new Error(`Minimum profit withdrawal is $${H.fmtC(s.profitMinCents)}`);
      if (amountCents > (u0.showcase_profit_cents || 0)) throw new Error('Insufficient Profit Balance');
      db.prepare('UPDATE users SET showcase_profit_cents=showcase_profit_cents-? WHERE id=?').run(amountCents, userId);
    } else {
      const bal = H.getOrCreateBalance(userId);
      if (bal.profit_cents < s.profitMinCents)
        throw new Error(`Profit Balance must be at least $${H.fmtC(s.profitMinCents)} to withdraw`);
      if (amountCents < s.profitMinCents) throw new Error(`Minimum profit withdrawal is $${H.fmtC(s.profitMinCents)}`);
      if (amountCents > bal.profit_cents) throw new Error('Insufficient Profit Balance');
      db.prepare('UPDATE balances SET profit_cents=profit_cents-?,updated_at=unixepoch() WHERE user_id=?').run(amountCents, userId);
    }
    const wId = db.prepare(`INSERT INTO withdrawals (user_id,type,amount_cents,fee_cents,net_cents,wallet_address,method,status) VALUES (?,'profit',?,0,?,?,'USDT BEP20','pending')`)
      .run(userId, amountCents, amountCents, walletAddress).lastInsertRowid;
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,0,?,?,?,?,?,?)')
      .run(userId, 'withdraw_profit', amountCents, amountCents, 'out', 'pending', `WD-${wId}`,
        'Profit withdraw — pending approval', `Profit -= $${H.fmtC(amountCents)}; fee $0; net $${H.fmtC(amountCents)}`);
    H.createAdminNotif(getMainDb(), 'withdraw', `Profit withdraw request $${H.fmtC(amountCents)}`, wId, isSc ? 'showcase_withdrawal' : 'withdrawal', 'withdrawals');
    return { wId, feeCents: 0, netCents: amountCents };
  })();
}

// Approves or rejects a pending withdrawal (action 'approve' / 'reject').
// Approve: marks the withdrawal approved and its History row completed
// (the money was already deducted at request time; the admin pays the
// user out of band). Reject: returns amount + fee to the balance and
// marks both rows rejected. Already-processed withdrawals are refused.
function processWithdrawal(withdrawalId, action, adminId, adminNote) {
  const db = getDb();
  return db.transaction(() => {
    const wd = db.prepare(`SELECT * FROM withdrawals WHERE id=? AND status='pending'`).get(withdrawalId);
    if (!wd) throw new Error('Withdrawal not found or already processed');
    const wu = db.prepare('SELECT is_showcase FROM users WHERE id=?').get(wd.user_id);
    const isSc = !!(wu && wu.is_showcase === 1);
    const newStatus = action === 'approve' ? 'paid' : 'rejected';
    db.prepare('UPDATE withdrawals SET status=?,admin_note=?,processed_by=?,processed_at=unixepoch(),updated_at=unixepoch() WHERE id=?')
      .run(newStatus, adminNote || null, adminId, withdrawalId);
    if (action === 'approve') {
      // Approving a first withdrawal to a new address confirms it for
      // future auto-sends (v122 address whitelist).
      try { confirmAddress(db, wd.user_id, wd.wallet_address); } catch (_) {}
    }
    if (action === 'reject') {
      if (isSc) {
        const scol = wd.type === 'profit' ? 'showcase_profit_cents' : 'showcase_main_cents';
        db.prepare(`UPDATE users SET ${scol}=${scol}+? WHERE id=?`).run(wd.amount_cents, wd.user_id);
      } else {
        const col = wd.type === 'profit' ? 'profit_cents' : 'main_cents';
        db.prepare(`UPDATE balances SET ${col}=${col}+?,updated_at=unixepoch() WHERE user_id=?`).run(wd.amount_cents, wd.user_id);
      }
      db.prepare(`UPDATE transactions SET status='rejected' WHERE reference=?`).run(`WD-${withdrawalId}`);
    } else {
      if (isSc) {
        db.prepare('UPDATE users SET showcase_withdraw_cents=showcase_withdraw_cents+? WHERE id=?').run(wd.net_cents, wd.user_id);
      } else {
        db.prepare('UPDATE balances SET total_withdrawn_cents=total_withdrawn_cents+?,updated_at=unixepoch() WHERE user_id=?').run(wd.net_cents, wd.user_id);
      }
      db.prepare(`UPDATE transactions SET status='completed' WHERE reference=?`).run(`WD-${withdrawalId}`);
    }
    // Notification: show the NET amount the user actually receives and
    // the fee reason. The old message showed only the gross amount, so a
    // user who withdrew $4,027.60 with a 15% early fee could not see the
    // $604.14 deduction or the $3,423.46 they actually received, or why.
    const s = H.getMoneySettings();
    const kind = wd.type === 'profit' ? 'Profit' : 'Main';
    const feeBp = wd.type === 'main' ? H.getWithdrawFeeBp(wd.user_id, s) : 0;
    let msg;
    if (newStatus === 'paid') {
      if (wd.fee_cents > 0) {
        const feeLabel = feeBp === s.earlyFeeBp
          ? `Early withdrawal fee ${(feeBp / 100)}% (your Main Balance is still in the ${s.lockMonths}-month lock period)`
          : `Withdrawal fee ${(feeBp / 100)}%`;
        msg = `Your $${H.fmtC(wd.amount_cents)} ${kind} withdrawal has been paid. ${feeLabel} — $${H.fmtC(wd.fee_cents)} deducted, you received $${H.fmtC(wd.net_cents)}.`;
      } else {
        msg = `Your $${H.fmtC(wd.amount_cents)} ${kind} withdrawal has been paid. No fee — you received $${H.fmtC(wd.net_cents)}.`;
      }
    } else {
      msg = `Your $${H.fmtC(wd.amount_cents)} ${kind} withdrawal was rejected. The full amount was returned to your ${kind} Balance.`;
    }
    if (adminNote) msg += ` Note: ${adminNote}`;
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(wd.user_id, `Withdrawal ${newStatus}`, msg,
        newStatus === 'paid' ? 'success' : 'warning');
  })();
}

// Admin credits a user's Main or Profit Balance: updates the balance,
// writes a completed 'admin_credit' transaction and an audit_log entry.
function adminAddBalance(userId, amountCents, balanceType, adminId, reason) {
  const db = getDb();
  return db.transaction(() => {
    H.getOrCreateBalance(userId);
    const col = balanceType === 'profit' ? 'profit_cents' : 'main_cents';
    db.prepare(`UPDATE balances SET ${col}=${col}+?,updated_at=unixepoch() WHERE user_id=?`).run(amountCents, userId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
      .run(userId, 'admin_credit', amountCents, amountCents, 'in', 'completed',
        reason || 'Nexora FX balance adjustment', `${balanceType} += $${H.fmtC(amountCents)} (Nexora FX)`);
    db.prepare('INSERT INTO audit_log (admin_id,user_id,action,entity,entity_id,after_value) VALUES (?,?,?,?,?,?)')
      .run(adminId, userId, `add_balance:${balanceType}:$${H.fmtC(amountCents)}`, 'user', userId, `${balanceType}+${amountCents}`);
  })();
}

module.exports = { requestMainWithdraw, requestProfitWithdraw, processWithdrawal, adminAddBalance };
