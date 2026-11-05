// auth middleware
const jwt = require('jsonwebtoken');
const { getDb } = require('../models/database');

function authUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'user') return res.status(401).json({ error: 'Unauthorized' });
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(payload.adminId);
    if (!admin) return res.status(401).json({ error: 'Admin not found' });
    req.admin = admin;
    req.adminId = admin.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function superAdminOnly(req, res, next) {
  if (!req.admin || req.admin.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

// Impersonation token middleware (Login as User)
function authImpersonation(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type === 'impersonation') {
      const db = getDb();
      const sess = db.prepare('SELECT * FROM impersonation_sessions WHERE token=? AND expires_at > ?').get(token, Math.floor(Date.now()/1000));
      if (!sess) return res.status(401).json({ error: 'Session expired' });
      const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(sess.user_id);
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = user;
      req.userId = user.id;
      req.isImpersonation = true;
      req.impersonationSession = sess;
      return next();
    }
    // Fall through to normal user auth
    if (payload.type !== 'user') return res.status(401).json({ error: 'Unauthorized' });
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authUser, authAdmin, superAdminOnly, authImpersonation };
