// services/moneyHelpers.js — shared money rules and balance helpers.
// One place for the money rules every service reads: getMoneySettings
// (early/regular withdraw fees, 3-month lock, profit minimum $10,
// referral 4%, profit target 10%), getBalance / getOrCreateBalance
// (the user's balances row), getWithdrawFeeBp / calcMainWithdrawFee
// (fee logic), createAdminNotif (admin-side notifications), fmtC.
// Rule: all money is integer cents; fmtC only formats cents for display.
const { getDb } = require('../models/database');

// Reads one site_settings value, or the default when the key is missing.
function getSetting(key, def) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM site_settings WHERE key=?').get(key);
  return row ? row.value : def;
}
// Returns all money settings with their defaults: early fee 1500 bp
// (15%), regular fee 0, lock 3 months, profit min $10, referral 400 bp
// (4%), profit target 1000 bp (10%).
function getMoneySettings() {
  return {
    earlyFeeBp: parseInt(getSetting('withdraw_early_fee_bp','1500')),
    regularFeeBp: parseInt(getSetting('withdraw_regular_fee_bp','0')),
    lockMonths: parseInt(getSetting('withdraw_lock_months','3')),
    profitMinCents: parseInt(getSetting('profit_min_cents','1000')),
    referralBp: parseInt(getSetting('referral_bp','400')),
  };
}
// Returns the user's balances row, creating an empty one when missing.
function getOrCreateBalance(userId) {
  const db = getDb();
  let bal = db.prepare('SELECT * FROM balances WHERE user_id=?').get(userId);
  if (!bal) {
    db.prepare('INSERT INTO balances (user_id) VALUES (?)').run(userId);
    bal = db.prepare('SELECT * FROM balances WHERE user_id=?').get(userId);
  }
  return bal;
}
// Reads the user's balances row (creating an empty one when missing).
function getBalance(userId) { return getOrCreateBalance(userId); }
// Formats integer cents as dollars with 2 decimals (display only).
function fmtC(c) { return (c/100).toFixed(2); }
// Writes one admin notification row (admin_notifications).
function createAdminNotif(db,type,title,refId,refType,pane) {
  db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
    .run(type,title,title,refId,refType,pane);
}
// Returns the withdraw fee for a user: the early fee (15%) while the
// Main Balance is still inside the 3-month lock (measured from the
// user's first deposit), otherwise the regular fee. A month is
// approximated as 30.44 days. No first deposit yet means the early fee.
function getWithdrawFeeBp(userId,settings) {
  const db = getDb();
  const bal = db.prepare('SELECT first_deposit_at FROM balances WHERE user_id=?').get(userId);
  if (!bal||!bal.first_deposit_at) return settings.earlyFeeBp;
  const months = (Date.now()/1000 - bal.first_deposit_at)/(30.44*24*3600);
  return months >= settings.lockMonths ? settings.regularFeeBp : settings.earlyFeeBp;
}
// Calculates the fee in cents for a Main withdrawal: fee_bp percent of
// the amount, rounded down (a 0 fee returns 0).
function calcMainWithdrawFee(userId,amountCents,settings) {
  return Math.floor(amountCents*getWithdrawFeeBp(userId,settings)/10000);
}
module.exports = { getSetting, getMoneySettings, getOrCreateBalance, getBalance, fmtC, createAdminNotif, calcMainWithdrawFee, getWithdrawFeeBp };
