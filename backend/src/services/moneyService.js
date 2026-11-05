// moneyService.js — deposit + referral commission
const { getDb } = require('../models/database');
const H = require('./moneyHelpers');

function payRef(userId, depCents, db, s) {
  const ref = db.prepare(`SELECT * FROM referrals WHERE referred_user_id=? AND status='pending'`).get(userId);
  if (!ref) return;
  const c = Math.floor(depCents * s.referralBp / 10000);
  db.prepare(`UPDATE referrals SET deposit_amount_cents=?,commission_cents=?,status='paid',paid_at=unixepoch() WHERE id=?`).run(depCents, c, ref.id);
  H.getOrCreateBalance(ref.referrer_user_id);
  db.prepare('UPDATE balances SET referral_cents=referral_cents+?,profit_cents=profit_cents+?,updated_at=unixepoch() WHERE user_id=?').run(c, c, ref.referrer_user_id);
  db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
    .run(ref.referrer_user_id, 'referral_commission', c, c, 'in', 'completed', 'Referral commission — 4% of deposit', `Profit += 4% x $${H.fmtC(depCents)} = $${H.fmtC(c)}`);
}

function applyDeposit(userId, depositId, amountCents, approverId) {
  const db = getDb(), s = H.getMoneySettings();
  return db.transaction(() => {
    H.getOrCreateBalance(userId);
    db.prepare('UPDATE balances SET main_cents=main_cents+?,total_deposited_cents=total_deposited_cents+?,first_deposit_at=COALESCE(first_deposit_at,unixepoch()),updated_at=unixepoch() WHERE user_id=?')
      .run(amountCents, amountCents, userId);
    db.prepare(`UPDATE deposits SET status='approved',approved_by=?,approved_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(approverId, depositId);
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,0,?,?,?,?,?,?)')
      .run(userId, 'deposit', amountCents, amountCents, 'in', 'completed', `DEP-${depositId}`, 'Deposit approved', `Main += $${H.fmtC(amountCents)}`);
    payRef(userId, amountCents, db, s);
    H.createAdminNotif(db, 'deposit', `Deposit approved $${H.fmtC(amountCents)}`, depositId, 'deposit', 'deposits');
  })();
}

module.exports = { applyDeposit };
