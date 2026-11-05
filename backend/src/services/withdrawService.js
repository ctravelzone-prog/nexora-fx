// withdrawService.js — main/profit withdraw + admin process + adminAddBalance
const { getDb } = require('../models/database');
const H = require('./moneyHelpers');

function requestMainWithdraw(userId, amountCents, walletAddress) {
  const db = getDb(), s = H.getMoneySettings();
  return db.transaction(() => {
    const bal = H.getOrCreateBalance(userId);
    if (bal.main_cents < amountCents) throw new Error('Insufficient Main Balance');
    if (amountCents <= 0) throw new Error('Amount must be positive');
    const feeCents = H.calcMainWithdrawFee(userId, amountCents, s);
    const netCents = amountCents - feeCents;
    db.prepare('UPDATE balances SET main_cents=main_cents-?,updated_at=unixepoch() WHERE user_id=?').run(amountCents, userId);
    const wId = db.prepare(`INSERT INTO withdrawals (user_id,type,amount_cents,fee_cents,net_cents,wallet_address,method,status) VALUES (?,'main',?,?,?,?,'USDT BEP20','pending')`)
      .run(userId, amountCents, feeCents, netCents, walletAddress).lastInsertRowid;
    const feeStr = feeCents > 0 ? `fee ${H.getWithdrawFeeBp(userId,s)/100}% = $${H.fmtC(feeCents)}` : 'fee $0';
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(userId, 'withdraw_main', amountCents, feeCents, netCents, 'out', 'pending', `WD-${wId}`,
        'Main withdraw — pending admin approval', `Main -= $${H.fmtC(amountCents)}; ${feeStr}; net $${H.fmtC(netCents)}`);
    H.createAdminNotif(db, 'withdraw', `Main withdraw request $${H.fmtC(amountCents)}`, wId, 'withdrawal', 'withdrawals');
    return { wId, feeCents, netCents };
  })();
}

function requestProfitWithdraw(userId, amountCents, walletAddress) {
  const db = getDb(), s = H.getMoneySettings();
  return db.transaction(() => {
    const bal = H.getOrCreateBalance(userId);
    if (bal.profit_cents < s.profitMinCents)
      throw new Error(`Profit Balance must be at least $${H.fmtC(s.profitMinCents)} to withdraw`);
    if (amountCents < s.profitMinCents) throw new Error(`Minimum profit withdrawal is $${H.fmtC(s.profitMinCents)}`);
    if (amountCents > bal.profit_cents) throw new Error('Insufficient Profit Balance');
    db.prepare('UPDATE balances SET profit_cents=profit_cents-?,updated_at=unixepoch() WHERE user_id=?').run(amountCents, userId);
    const wId = db.prepare(`INSERT INTO withdrawals (user_id,type,amount_cents,fee_cents,net_cents,wallet_address,method,status) VALUES (?,'profit',?,0,?,?,'USDT BEP20','pending')`)
      .run(userId, amountCents, amountCents, walletAddress).lastInsertRowid;
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,0,?,?,?,?,?,?)')
      .run(userId, 'withdraw_profit', amountCents, amountCents, 'out', 'pending', `WD-${wId}`,
        'Profit withdraw — pending admin approval', `Profit -= $${H.fmtC(amountCents)}; fee $0; net $${H.fmtC(amountCents)}`);
    H.createAdminNotif(db, 'withdraw', `Profit withdraw request $${H.fmtC(amountCents)}`, wId, 'withdrawal', 'withdrawals');
    return { wId, feeCents: 0, netCents: amountCents };
  })();
}

function processWithdrawal(withdrawalId, action, adminId, adminNote) {
  const db = getDb();
  return db.transaction(() => {
    const wd = db.prepare(`SELECT * FROM withdrawals WHERE id=? AND status='pending'`).get(withdrawalId);
    if (!wd) throw new Error('Withdrawal not found or already processed');
    const newStatus = action === 'approve' ? 'paid' : 'rejected';
    db.prepare('UPDATE withdrawals SET status=?,admin_note=?,processed_by=?,processed_at=unixepoch(),updated_at=unixepoch() WHERE id=?')
      .run(newStatus, adminNote || null, adminId, withdrawalId);
    if (action === 'reject') {
      const col = wd.type === 'profit' ? 'profit_cents' : 'main_cents';
      db.prepare(`UPDATE balances SET ${col}=${col}+?,updated_at=unixepoch() WHERE user_id=?`).run(wd.amount_cents, wd.user_id);
      db.prepare(`UPDATE transactions SET status='rejected' WHERE reference=?`).run(`WD-${withdrawalId}`);
    } else {
      db.prepare('UPDATE balances SET total_withdrawn_cents=total_withdrawn_cents+?,updated_at=unixepoch() WHERE user_id=?').run(wd.net_cents, wd.user_id);
      db.prepare(`UPDATE transactions SET status='completed' WHERE reference=?`).run(`WD-${withdrawalId}`);
    }
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(wd.user_id, `Withdrawal ${newStatus}`, `Your $${H.fmtC(wd.amount_cents)} withdrawal has been ${newStatus}.`,
        newStatus === 'paid' ? 'success' : 'warning');
  })();
}

function adminAddBalance(userId, amountCents, balanceType, adminId, reason) {
  const db = getDb();
  return db.transaction(() => {
    H.getOrCreateBalance(userId);
    const col = balanceType === 'profit' ? 'profit_cents' : 'main_cents';
    db.prepare(`UPDATE balances SET ${col}=${col}+?,updated_at=unixepoch() WHERE user_id=?`).run(amountCents, userId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
      .run(userId, 'admin_credit', amountCents, amountCents, 'in', 'completed',
        reason || 'Admin balance adjustment', `${balanceType} += $${H.fmtC(amountCents)} (admin)`);
    db.prepare('INSERT INTO audit_log (admin_id,user_id,action,entity,entity_id,after_value) VALUES (?,?,?,?,?,?)')
      .run(adminId, userId, `add_balance:${balanceType}:$${H.fmtC(amountCents)}`, 'user', userId, `${balanceType}+${amountCents}`);
  })();
}

module.exports = { requestMainWithdraw, requestProfitWithdraw, processWithdrawal, adminAddBalance };
