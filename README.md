# Nexora Fx — Full-Stack Copy Trading Platform

## Quick Start
```bash
cd backend
npm install
npm run seed
npm start
# http://localhost:3000  (user site)
# http://localhost:3000/admin  (admin panel)
```

## Demo Credentials
| Role | Username/Email | Password |
|------|--------------|----------|
| Demo User | `nexora_fx` | `demo1234` |
| Super Admin | `admin@nexorafxuk` | `admin1234` |

**Change admin password immediately** via admin panel or:
```bash
cd backend && npm run change-admin-password
```

## Stack
- Backend: Node.js + Express
- Database: SQLite via Node built-in `node:sqlite` (Node 22+) — no DB server needed
- Frontend: HTML + Tailwind CSS (CDN) — vanilla JS SPA
- Auth: JWT + bcrypt + TOTP 2FA (RFC 6238)

## Money Rules (backend-enforced)
- Deposit → Main Balance only (Binance Pay, manual TxID approval)
- Copy moves Main → Copy Invested; profit on Copy Invested only
- Withdraw from Main only (USDT BEP20, manual admin approval)
- Early withdraw fee: 15% before 3 months; regular withdraw fee after lock: 0% by default (admin sets it in Money Settings)
- Profit withdraw min $10, no fee, no lock
- Referral: one-time 4% of referred user's first deposit only
- Total Value = Main + Copy Invested + Profit Balance
- All money stored as integer cents — never floats

## 22-Day Profit Cycle
- Target 10% over 22 weekday days (Sat/Sun skipped)
- 2 or 3 loss days per month, dynamic shuffle
- Day 22 balances to exactly 10.00%
- This is a target, never a guarantee

## Change Settings from Admin
- Profit schedule: Admin → Profit System → Generate / Manual Edit
- Fees/minimums: Admin → Money Settings (Super Admin, audit-logged)
- Deposit wallet/QR: Admin → Deposit Wallet Settings
- Hero image: Admin → Home Page Manage (Site Settings/CMS → Media Library)
- KYC on/off: Admin → KYC Control (OFF at start)
- 2FA on/off: Admin → 2FA Control (both OFF at start)

## Email (SMTP)
If SMTP not configured, verify/reset links are logged to console (dev only).
Users see "Email is not configured — contact admin" in production.

## Admin Login Path
Set in `backend/src/config/admin.js` — import `ADMIN_LOGIN_PATH` everywhere, never hard-code.

## Honest Limits
- Binance Pay = manual TxID approval only (no webhook)
- USDT BEP20 withdraw = manual admin queue (no auto-payout)
- Payment Gateways "Add New" creates a Deactivated row only
- New payment method or chart type needs code changes

## Known: node:sqlite
Uses Node.js built-in `node:sqlite` (available in Node 22+).
`db.transaction()` is shimmed since node:sqlite doesn't have it natively.

## Do NOT go live with
- Sample/seed data or demo passwords
- Placeholder JWT_SECRET
- Missing SMTP config without telling users

See `.env.example` for all required environment variables.
