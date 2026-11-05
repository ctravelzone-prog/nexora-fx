// admin/moneyRequests.js — list + approve (adds Main Balance) / reject money requests
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { adminAddBalance } = require('../../services/withdrawService');

router.get('/', authAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT mr.*, u.full_name, u.username, u.email FROM money_requests mr JOIN users u ON u.id=mr.user_id ORDER BY CASE WHEN mr.status='pending' THEN 0 ELSE 1 END, mr.created_at DESC`).all();
  res.json(rows);
});

router.post('/:id/approve', authAdmin, (req, res) => {
  const db = getDb();
  const r = db.prepare('SELECT * FROM money_requests WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.status !== 'pending') return res.status(400).json({ error: 'Request already ' + r.status });
  adminAddBalance(r.user_id, r.amount_cents, 'main', req.adminId, 'Money request #' + r.id + ' approved');
  db.prepare("UPDATE money_requests SET status='approved',updated_at=unixepoch() WHERE id=?").run(r.id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)').run(r.user_id, 'Money request approved', `Your $${(r.amount_cents / 100).toFixed(2)} request was approved and added to your Main Balance.`, 'success');
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId, r.user_id, 'money_request_approved');
  res.json({ success: true });
});

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
