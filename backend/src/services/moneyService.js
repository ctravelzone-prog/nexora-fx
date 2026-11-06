// services/moneyService.js — deposit approval and referral payout.
// applyDeposit: an admin-approved deposit credits the user's Main Balance
// (and marks the pending History row completed), sets the user's
// first_deposit_at on their first deposit, and pays the referrer.
// payRef: pays the referrer a one-time 4% of the referred user's FIRST
// deposit only (never on later deposits, never on profit) and records it
// in referrals.
// Rule: all money is integer cents. The deposit itself is submitted by
// the user in routes/deposit.js; this file only settles it.
const { getDb } = require('../models/database');
const H = require('./moneyHelpers');

// Pays the referrer once, on the user's FIRST deposit only: 4% of the
// deposit, added to the referrer's REFERRAL balance (not Profit — the
// user moves it to Profit with the transfer option when they want it),
// with the referrals row marked 'paid'. Does nothing when there is no
// referrer or the referral was already paid.
function payRef(userId, depCents, db, s) {
  const ref = db.prepare(`SELECT * FROM referrals WHERE referred_user_id=? AND status='pending'`).get(userId);
  if (!ref) return;
  const c = Math.floor(depCents * s.referralBp / 10000);
  db.prepare(`UPDATE referrals SET deposit_amount_cents=?,commission_cents=?,status='paid',paid_at=unixepoch() WHERE id=?`).run(depCents, c, ref.id);
  H.getOrCreateBalance(ref.referrer_user_id);
  db.prepare('UPDATE balances SET referral_cents=referral_cents+?,updated_at=unixepoch() WHERE user_id=?').run(c, ref.referrer_user_id);
  db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
    .run(ref.referrer_user_id, 'referral_commission', c, c, 'in', 'completed', 'Referral commission — 4% of deposit', `Referral += 4% x $${H.fmtC(depCents)} = $${H.fmtC(c)} (transfer to Profit when you like)`);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
    .run(ref.referrer_user_id, 'Referral commission', `You earned $${H.fmtC(c)} referral commission (4% of a $${H.fmtC(depCents)} deposit). It is in your Referral Bonus — transfer it to Profit whenever you like.`, 'success');
}

// Approves a pending deposit: sets first_deposit_at on the user's first
// deposit, adds the amount to Main Balance, marks the deposits row
// 'approved', marks the pending History row completed (or inserts one
// for deposits submitted before pending rows existed), then pays the
// referrer via payRef.
function applyDeposit(userId, depositId, amountCents, approverId) {
  const db = getDb(), s = H.getMoneySettings();
  return db.transaction(() => {
    H.getOrCreateBalance(userId);
    db.prepare('UPDATE balances SET main_cents=main_cents+?,total_deposited_cents=total_deposited_cents+?,first_deposit_at=COALESCE(first_deposit_at,unixepoch()),updated_at=unixepoch() WHERE user_id=?')
      .run(amountCents, amountCents, userId);
    db.prepare(`UPDATE deposits SET status='approved',approved_by=?,approved_at=unixepoch(),updated_at=unixepoch() WHERE id=?`).run(approverId, depositId);
    // The pending row was created at submit time — flip it to completed.
    // Fall back to INSERT for deposits submitted before this change.
    const upd = db.prepare(`UPDATE transactions SET status='completed' WHERE reference=?`).run(`DEP-${depositId}`);
    if (!upd.changes) {
      db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,0,?,?,?,?,?,?)')
        .run(userId, 'deposit', amountCents, amountCents, 'in', 'completed', `DEP-${depositId}`, 'Deposit approved', `Main += $${H.fmtC(amountCents)}`);
    }
    payRef(userId, amountCents, db, s);
    H.createAdminNotif(db, 'deposit', `Deposit approved $${H.fmtC(amountCents)}`, depositId, 'deposit', 'deposits');
    // The user must see this on their dashboard bell right away.
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(userId, 'Deposit approved', `Your deposit of $${H.fmtC(amountCents)} has been approved and added to your Main Balance.`, 'success');
  })();
}

module.exports = { applyDeposit };
