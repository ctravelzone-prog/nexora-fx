// middleware/auth.js — JWT authentication and authorization guards.
// Verifies the Bearer token from the Authorization header and loads the
// matching admin or user row onto req (req.admin / req.user, req.adminId /
// req.userId). Four guards: authUser (user JWT), authAdmin (admin JWT),
// superAdminOnly (role must be 'Super Admin'), authImpersonation (accepts
// a normal user JWT or an admin 'Login as User' impersonation JWT).
// Rule: admin JWTs expire in 7 days; user JWTs expire in 7 days.
// A missing, wrong-type or expired token always answers 401.
// Showcase users (is_showcase=1) live in the SEPARATE showcase database.
// Their JWT carries isShowcase=true, and authUser/authImpersonation load
// them from that DB and run the rest of the request inside an
// AsyncLocalStorage store for it, so every getDb() in the request (routes
// and services) hits the showcase DB. Real users run against the main DB.
// Admin data (admins, admin_notifications, audit_log) always lives in the
// main DB — authAdmin reads getMainDb() explicitly.
const jwt = require('jsonwebtoken');
const { getDb, getMainDb, getShowcaseDb, als } = require('../models/database');

// Guard for user routes. Requires a JWT with type 'user' and an active
// user row; sets req.user / req.userId / req.db / req.isShowcase and runs
// the rest of the request in the right database's context. Answers 401
// otherwise.
function authUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'user') return res.status(401).json({ error: 'Unauthorized' });
    const isShowcase = payload.isShowcase === true;
    const db = isShowcase ? getShowcaseDb() : getMainDb();
    const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user.id;
    req.db = db;
    req.isShowcase = isShowcase;
    als.run({ db }, next);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Guard for admin routes. Requires a JWT with type 'admin' and an
// existing admin row; sets req.admin / req.adminId. Answers 401 otherwise.
function authAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    const db = getMainDb();
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(payload.adminId);
    if (!admin) return res.status(401).json({ error: 'Admin not found' });
    req.admin = admin;
    req.adminId = admin.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Extra guard used after authAdmin: only the 'Super Admin' role passes.
// Used for destructive or money-critical admin actions.
function superAdminOnly(req, res, next) {
  if (!req.admin || req.admin.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

// Guard for user routes that also accepts an admin impersonation token.
// An impersonation JWT (type 'impersonation') must have a live row in
// impersonation_sessions; sets req.isImpersonation = true so write routes
// can refuse it. Falls through to normal user auth for a 'user' JWT.
// Impersonation (Login as User) is real users only — it always runs on
// the main DB, never the showcase DB.
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
      const db = getMainDb();
      const sess = db.prepare('SELECT * FROM impersonation_sessions WHERE token=? AND expires_at > ?').get(token, Math.floor(Date.now()/1000));
      if (!sess) return res.status(401).json({ error: 'Session expired' });
      const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(sess.user_id);
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = user;
      req.userId = user.id;
      req.isImpersonation = true;
      req.impersonationSession = sess;
      req.db = db;
      req.isShowcase = false;
      return als.run({ db }, next);
    }
    // Fall through to normal user auth
    if (payload.type !== 'user') return res.status(401).json({ error: 'Unauthorized' });
    const isShowcase = payload.isShowcase === true;
    const db = isShowcase ? getShowcaseDb() : getMainDb();
    const user = db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user.id;
    req.db = db;
    req.isShowcase = isShowcase;
    als.run({ db }, next);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authUser, authAdmin, superAdminOnly, authImpersonation };
