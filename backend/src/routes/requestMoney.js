// routes/requestMoney.js — user asks the admin for a balance correction.
// POST / creates a money_requests row (one pending request at a time,
// max $1,000,000, reason up to 500 chars) and notifies the admin.
// GET / lists the user's own requests, newest first.
// When an admin approves, the amount is added to the user's Main Balance
// (see admin/moneyRequests.js). This is a manual correction flow, not a
// deposit: no Binance Pay transaction is involved.
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { createAdminNotif } = require('../services/moneyHelpers');

// POST /api/request-money — create a request (one pending at a time)
router.post('/', authImpersonation, (req, res) => {
  if (req.isImpersonation) return res.status(403).json({ error: 'Not allowed during Login as User session' });
  const { amount, reason } = req.body || {};
  const cents = Math.round(parseFloat(amount) * 100);
  if (!cents || cents <= 0) return res.status(400).json({ error: 'Enter a valid amount' });
  if (cents > 100000000) return res.status(400).json({ error: 'Amount too large' });
  const db = getDb();
  // Per-user switch (Money Settings > User Access Controls): the admin can
  // turn Request Money off for one user, or on once (auto-off on approve).
  const rmFlag = db.prepare('SELECT request_money_enabled FROM users WHERE id=?').get(req.userId);
  if (rmFlag && rmFlag.request_money_enabled === 0) return res.status(403).json({ error: 'Request Money is disabled for your account' });
  const pend = db.prepare("SELECT id FROM money_requests WHERE user_id=? AND status='pending'").get(req.userId);
  if (pend) return res.status(400).json({ error: 'You already have a pending request. Please wait for admin.' });
  const r = db.prepare('INSERT INTO money_requests (user_id,amount_cents,reason) VALUES (?,?,?)').run(req.userId, cents, String(reason || '').slice(0, 500));
  const u = db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);
  createAdminNotif(db, 'money_request', `New money request — ${u.full_name} (@${u.username}) · $${(cents / 100).toFixed(2)}`, r.lastInsertRowid, 'money_request', 'request-money');
  res.json({ success: true, id: r.lastInsertRowid });
});

// GET /api/request-money — my requests, newest first
router.get('/', authImpersonation, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM money_requests WHERE user_id=? ORDER BY created_at DESC').all(req.userId);
  res.json(rows);
});

module.exports = router;
