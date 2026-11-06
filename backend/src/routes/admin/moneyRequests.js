// routes/admin/moneyRequests.js — admin side of balance-correction requests.
// GET / lists money requests (pending first). POST /:id/approve adds the
// requested amount to the user's Main Balance (via adminAddBalance) and
// marks the request approved. POST /:id/reject turns it down.
// Rule: a user can have only one pending request at a time (enforced when
// they submit it).
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { adminAddBalance } = require('../../services/withdrawService');

// GET / — all money requests with user name/username, pending first.
router.get('/', authAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT mr.*, u.full_name, u.username, u.email FROM money_requests mr JOIN users u ON u.id=mr.user_id ORDER BY CASE WHEN mr.status='pending' THEN 0 ELSE 1 END, mr.created_at DESC`).all();
  res.json(rows);
});

// POST /:id/approve — approves the request: adds the amount to the
// user's Main Balance and marks the request approved.
router.post('/:id/approve', authAdmin, (req, res) => {
  const db = getDb();
  const r = db.prepare('SELECT * FROM money_requests WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.status !== 'pending') return res.status(400).json({ error: 'Request already ' + r.status });
  adminAddBalance(r.user_id, r.amount_cents, 'main', req.adminId, 'Money request #' + r.id + ' approved');
  db.prepare("UPDATE money_requests SET status='approved',updated_at=unixepoch() WHERE id=?").run(r.id);
  // One-time enable backstop: the switch normally turns off when the user
  // submits their request; if it was enabled once while a request was
  // already pending, it switches off here instead, right after approval.
  const rmFlag = db.prepare('SELECT request_money_one_time FROM users WHERE id=?').get(r.user_id);
  if (rmFlag && rmFlag.request_money_one_time === 1) db.prepare('UPDATE users SET request_money_enabled=0, request_money_one_time=0 WHERE id=?').run(r.user_id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)').run(r.user_id, 'Money request approved', `Your $${(r.amount_cents / 100).toFixed(2)} request was approved and added to your Main Balance.`, 'success');
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId, r.user_id, 'money_request_approved');
  res.json({ success: true });
});

// POST /:id/reject — rejects the request. No money moves.
router.post('/:id/reject', authAdmin, (req, res) => {
  const db = getDb();
  const r = db.prepare('SELECT * FROM money_requests WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.status !== 'pending') return res.status(400).json({ error: 'Request already ' + r.status });
  const note = String((req.body && req.body.note) || '').slice(0, 500);
  db.prepare("UPDATE money_requests SET status='rejected',admin_note=?,updated_at=unixepoch() WHERE id=?").run(note, r.id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)').run(r.user_id, 'Money request rejected', `Your $${(r.amount_cents / 100).toFixed(2)} request was rejected.` + (note ? (' Reason: ' + note) : ''), 'warning');
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId, r.user_id, 'money_request_rejected');
  res.json({ success: true });
});

module.exports = router;
