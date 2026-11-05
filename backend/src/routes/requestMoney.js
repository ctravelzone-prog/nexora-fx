// requestMoney.js — user requests a balance correction; admin approves (adds Main Balance) or rejects
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
