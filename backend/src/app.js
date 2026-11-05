// Nexora Fx — Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { getDb } = require('./models/database');
const { ADMIN_LOGIN_PATH } = require('./config/admin');

const app = express();
app.set('trust proxy', 1); // behind Render proxy — rate limit uses real client IP

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/assets', express.static(path.join(__dirname, '../../frontend/assets')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Initialise DB
getDb();

// Daily auto profit (Mon-Fri, 12:00 PM Dhaka, Sat/Sun skipped; manual Apply stays)
try { require('./services/autoProfit').startAutoProfit(); }
catch (e) { console.error('[auto-profit] Scheduler failed to start:', e.message); }

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth2'));
app.use('/api/user', require('./routes/user'));
app.use('/api/deposit', require('./routes/deposit'));
app.use('/api/withdraw', require('./routes/withdraw'));
app.use('/api/copy', require('./routes/copy'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/support', require('./routes/support'));
app.use('/api/request-money', require('./routes/requestMoney'));
app.use('/api/2fa', require('./routes/twofa'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/market', require('./routes/market'));

// Admin routes (all under /api/admin/*)
app.use('/api/admin/auth', require('./routes/admin/auth'));
app.use('/api/admin', require('./routes/admin/dashboard'));
app.use('/api/admin/finance', require('./routes/admin/finance'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/traders', require('./routes/admin/traders'));
app.use('/api/admin/profit', require('./routes/admin/profit'));
app.use('/api/admin/settings', require('./routes/admin/settings'));
app.use('/api/admin/kyc', require('./routes/admin/kyc'));
app.use('/api/admin/tickets', require('./routes/admin/tickets'));
app.use('/api/admin/forget-requests', require('./routes/admin/forget'));
app.use('/api/admin/money-requests', require('./routes/admin/moneyRequests'));
app.use('/api/admin', require('./routes/admin/misc'));

// Public settings API (no auth)
app.get('/api/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key,value FROM site_settings').all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  res.json(s);
});

// Serve frontend
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Admin login page route
app.get(ADMIN_LOGIN_PATH, (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nNexora Fx running at http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}${ADMIN_LOGIN_PATH}`);
  console.log(`Press Ctrl+C to stop\n`);
});

module.exports = app;
