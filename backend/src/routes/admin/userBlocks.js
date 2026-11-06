// routes/admin/userBlocks.js — per-user Deposit/Withdraw blocks and the
// per-user Request Money switch (Money Settings > User Access Controls).
// GET / lists the currently blocked users (deposit/withdraw) and the users
// whose Request Money is switched off. POST / blocks a user for one kind.
// DELETE /:id unblocks (the row disappears from the history list).
// POST /request-money turns Request Money on/off for one user, optionally
// one-time only (it switches off again after the admin approves that
// user's next money request).
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

// GET / — blocked users + Request Money switched-off users.
router.get('/', authAdmin, (req, res) => {
  const db = getDb();
  const blocks = db.prepare(`SELECT ub.*, u.full_name, u.username, u.email FROM user_blocks ub JOIN users u ON u.id=ub.user_id ORDER BY ub.created_at DESC`).all();
  const requestMoneyOff = db.prepare(`SELECT id, full_name, username, email, request_money_one_time, updated_at FROM users WHERE request_money_enabled=0 ORDER BY updated_at DESC`).all();
  res.json({ blocks, requestMoneyOff });
});

// POST / — block one user for deposit or withdraw.
router.post('/', authAdmin, (req, res) => {
  const db = getDb();
  const userId = parseInt(req.body.user_id, 10);
  const kind = String(req.body.kind || '');
  if (!userId) return res.status(400).json({ error: 'User is required' });
  if (kind !== 'deposit' && kind !== 'withdraw') return res.status(400).json({ error: 'Kind must be deposit or withdraw' });
  const user = db.prepare('SELECT id, full_name, username FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const r = db.prepare('INSERT OR IGNORE INTO user_blocks (user_id, kind, created_by_admin_id) VALUES (?,?,?)').run(userId, kind, req.adminId);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId, userId, 'user_block_' + kind);
  const row = db.prepare('SELECT * FROM user_blocks WHERE user_id=? AND kind=?').get(userId, kind);
  res.json({ success: true, already: r.changes === 0, block: row });
});

// DELETE /:id — unblock (removes the row, so it leaves the history list).
router.delete('/:id', authAdmin, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM user_blocks WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Block not found' });
  db.prepare('DELETE FROM user_blocks WHERE id=?').run(req.params.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId, row.user_id, 'user_unblock_' + row.kind);
  res.json({ success: true });
});

// POST /request-money — switch Request Money on/off for one user.
// Body: {user_id, enabled: 0|1, one_time: 0|1}. one_time=1 means the switch
// turns itself off again after the admin approves that user's next
// money request (see routes/admin/moneyRequests.js).
router.post('/request-money', authAdmin, (req, res) => {
  const db = getDb();
  const userId = parseInt(req.body.user_id, 10);
  const enabled = req.body.enabled ? 1 : 0;
  const oneTime = req.body.one_time ? 1 : 0;
  if (!userId) return res.status(400).json({ error: 'User is required' });
  const user = db.prepare('SELECT id, full_name, username FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // One-time only makes sense when enabling; enabling permanently clears it.
  db.prepare('UPDATE users SET request_money_enabled=?, request_money_one_time=?, updated_at=unixepoch() WHERE id=?').run(enabled, enabled ? oneTime : 0, userId);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId, userId, enabled ? (oneTime ? 'request_money_enabled_once' : 'request_money_enabled') : 'request_money_disabled');
  res.json({ success: true, enabled, one_time: enabled ? oneTime : 0 });
});

module.exports = router;
