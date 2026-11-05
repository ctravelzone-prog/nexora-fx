// moneyService.js Part 1 — settings/balance helpers
const { getDb } = require('../models/database');

function getSetting(key, def) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM site_settings WHERE key=?').get(key);
  return row ? row.value : def;
}
function getMoneySettings() {
  return {
    earlyFeeBp: parseInt(getSetting('withdraw_early_fee_bp','1500')),
    regularFeeBp: parseInt(getSetting('withdraw_regular_fee_bp','0')),
    lockMonths: parseInt(getSetting('withdraw_lock_months','3')),
    profitMinCents: parseInt(getSetting('profit_min_cents','1000')),
    referralBp: parseInt(getSetting('referral_bp','400')),
  };
}
function getOrCreateBalance(userId) {
  const db = getDb();
  let bal = db.prepare('SELECT * FROM balances WHERE user_id=?').get(userId);
  if (!bal) {
    db.prepare('INSERT INTO balances (user_id) VALUES (?)').run(userId);
    bal = db.prepare('SELECT * FROM balances WHERE user_id=?').get(userId);
  }
  return bal;
}
function getBalance(userId) { return getOrCreateBalance(userId); }
function fmtC(c) { return (c/100).toFixed(2); }
function createAdminNotif(db,type,title,refId,refType,pane) {
  db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
    .run(type,title,title,refId,refType,pane);
}
function getWithdrawFeeBp(userId,settings) {
  const db = getDb();
  const bal = db.prepare('SELECT first_deposit_at FROM balances WHERE user_id=?').get(userId);
  if (!bal||!bal.first_deposit_at) return settings.earlyFeeBp;
  const months = (Date.now()/1000 - bal.first_deposit_at)/(30.44*24*3600);
  return months >= settings.lockMonths ? settings.regularFeeBp : settings.earlyFeeBp;
}
function calcMainWithdrawFee(userId,amountCents,settings) {
  return Math.floor(amountCents*getWithdrawFeeBp(userId,settings)/10000);
}
module.exports = { getSetting, getMoneySettings, getOrCreateBalance, getBalance, fmtC, createAdminNotif, calcMainWithdrawFee, getWithdrawFeeBp };
