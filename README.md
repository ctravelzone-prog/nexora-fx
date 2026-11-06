# Nexora Fx — Full-Stack Copy Trading Platform

UK-based copy-trading / fund-management platform for forex and crypto traders.
Users deposit (Binance Pay), copy top traders, earn a daily profit target, and
withdraw (USDT BEP20). Admins approve deposits/withdrawals and manage users,
traders, profit schedules, and site settings from a separate admin panel.

**Version in this zip: v63** — v62 code + both warning boxes removed from the Create Deposit page. The live site runs the same code — see [Deployment](#deployment) before you push anything.

> **A new developer should read this file first, then the header comment at
> the top of any source file.** Every source file has a header comment that
> explains what it does, and the tricky parts have inline comments.

## Quick Start

```bash
cd backend
npm install
npm run seed
npm start
# http://localhost:3000        (user site)
# http://localhost:3000/admin  (admin panel)
```

Windows: double-click `START.bat` instead (it installs dependencies, seeds
the database on first run, and opens the site). See `RUN-ME-FIRST.txt`.

Requirements: **Node.js 22+** (the database uses built-in `node:sqlite`).
No database server is needed — data lives in one SQLite file,
`backend/nexora-fx.db`.

## Demo Credentials

| Role | Username/Email | Password |
|------|--------------|----------|
| Demo User | `nexora_fx` | `demo1234` |
| Super Admin | `admin@nexorafxuk` | `admin1234` |

**Change the admin password immediately** via the admin panel or:

```bash
cd backend && npm run change-admin-password
```

## Stack

- Backend: Node.js + Express
- Database: SQLite via Node built-in `node:sqlite` (Node 22+) — no DB server needed
- Frontend: HTML + Tailwind CSS (CDN) — vanilla JS single-page app (SPA)
- Auth: JWT + bcrypt + TOTP 2FA (RFC 6238)
- Live prices: TradingView widgets + public APIs (Binance, gold-api, Yahoo, CoinGecko)

## Project Structure

```
nexora-fx/
├── README.md                 This file — start here
├── RUN-ME-FIRST.txt          2-step run guide (Windows, non-technical)
├── START.bat                 One-click Windows launcher
├── render.yaml               Render.com deploy config (free plan)
├── package.json              Root scripts (start / setup / seed)
├── .env.example              All environment variables (copy to .env)
├── backend/
│   ├── package.json          Backend deps + scripts (start / seed)
│   ├── .env                  YOUR secrets — never commit (see .env.example)
│   ├── nexora-fx.db          SQLite database file (created by seed)
│   ├── uploads/              User-uploaded files (profile photos, favicon, QR)
│   ├── scripts/
│   │   └── changeAdminPassword.js   Reset the admin password from CLI
│   └── src/
│       ├── app.js            Server entry: middleware, rate limits, route mounts
│       ├── seed.js           First-run seed: demo user, admin, traders, settings
│       ├── config/admin.js   Admin login path constant (never hard-code it)
│       ├── middleware/auth.js  JWT auth: user, admin, impersonation (Login as User)
│       ├── models/
│       │   ├── database.js   getDb(): opens SQLite, runs schemas + migrations
│       │   ├── schema1.js    Core tables (users, balances, deposits, ...)
│       │   └── schema2.js    Later tables (showcase_profit_log, forget_requests, ...)
│       ├── routes/           HTTP endpoints, grouped by area (see below)
│       │   ├── auth.js auth2.js user.js deposit.js withdraw.js copy.js
│       │   ├── kyc.js referral.js requestMoney.js support.js twofa.js market.js
│       │   └── admin/        Admin-only endpoints (auth, dashboard, finance,
│       │                     users, traders, profit, settings, tickets, ...)
│       └── services/         Business logic (routes stay thin, logic lives here)
│           ├── moneyHelpers.js   Balances, fees, settings, formatting (cents)
│           ├── moneyService.js   Deposit approval (applyDeposit)
│           ├── withdrawService.js Withdraw request + admin process + Add Balance
│           ├── copyService.js    Start / increase / decrease / stop a copy
│           ├── profitService.js  Daily PnL engine + 22-day schedule + showcase profit
│           ├── autoProfit.js     Auto Profit: Mon–Fri 12:00 PM Asia/Dhaka
│           └── emailService.js   SMTP mailer (optional; logs without SMTP)
└── frontend/
    ├── index.html            User site shell (loads the JS below)
    ├── admin.html            Admin site shell
    ├── css/app.css           All custom styles
    ├── assets/               Logo, favicon, hero image, tier frames, broker logos
    └── js/
        ├── api.js            All API calls (one function per endpoint)
        ├── admin-api.js      All ADMIN api calls
        ├── app.js            SPA router + login/session handling
        ├── components.js components2.js  Shared UI: layout, sidebar, topbar, cards
        ├── utils.js          Formatting, badges, modals, toasts, avatar
        ├── templates.js      Shared HTML snippets
        ├── pages/            One file per user screen (dashboard, copyTrade,
        │                     deposit, withdraw, history, landing, ...)
        └── admin/            One file per admin screen (dashboard, finance,
                              users, showcase, settings, tickets, ...)
```

### Routes at a glance (backend)

| File | What it serves |
|------|---------------|
| `routes/auth.js` | Register / login / logout / forgot-password (user) |
| `routes/auth2.js` | 2FA setup, verify, authenticator reset |
| `routes/user.js` | `/api/user/me` (profile + balances), profile, transactions, notifications |
| `routes/deposit.js` | Submit deposit (Binance Pay TxID); deposit history |
| `routes/withdraw.js` | Main + Profit withdraw requests; withdraw history |
| `routes/copy.js` | Traders list, my copies, start/increase/decrease/stop |
| `routes/market.js` | Live prices (BTC/XAU), holidays, public settings |
| `routes/kyc.js` | KYC submission + status |
| `routes/referral.js` | Referral link, referred users, commission |
| `routes/support.js` | Support tickets (user side, live polling) |
| `routes/twofa.js` | 2FA pages (user) |
| `routes/admin/*.js` | Everything under `/api/admin/*` (see file headers) |

### How a request flows

```
Browser (SPA page in frontend/js/pages/*)
  → api.js / admin-api.js            (fetch with JWT in Authorization header)
  → backend/src/app.js               (rate limits, JSON parsing, route mounts)
  → routes/*.js                      (validate input, check auth, call service)
  → services/*.js                    (business rules, DB transaction)
  → models/database.js (node:sqlite) (SQLite file backend/nexora-fx.db)
  → JSON response → page re-renders
```

Frontend pages never talk to the database directly. Admin pages never use
user tokens (admin has its own JWT, stored separately).

## Money Rules (backend-enforced)

- Deposit → Main Balance only (Binance Pay, manual TxID approval)
- Copy moves Main → Copy Invested; profit on Copy Invested only
- Withdraw from Main only (USDT BEP20, manual admin approval)
- Early withdraw fee: 15% before 3 months; regular withdraw fee after lock: 0% by default (admin sets it in Money Settings)
- Profit withdraw min $10, no fee, no lock
- Referral: one-time 4% of referred user's first deposit only
- Total Value = Main + Copy Invested + Profit Balance
- All money stored as **integer cents** — never floats

## 22-Day Profit Cycle

- Target 10% over 22 weekday days (Sat/Sun skipped)
- 2 or 3 loss days per month, dynamic shuffle
- Day 22 balances to exactly 10.00%
- This is a target, never a guarantee
- Auto Profit applies the day's rate Mon–Fri at 12:00 PM Asia/Dhaka
  (only while the server is running; a sleeping free server pauses it)

## Showcase Accounts (demo accounts)

Showcase accounts are **demo accounts for display only**. They behave like
real accounts inside the app, but their money is fake and must never appear
in admin totals, ledgers, or reports.

- A showcase user has `users.is_showcase = 1` and four DISPLAY fields on
  the users row: `showcase_main_cents`, `showcase_copy_cents`,
  `showcase_profit_cents`, `showcase_withdraw_cents`.
- The admin sets those numbers in Admin → Showcase Accounts → Create / Edit.
- The showcase user's own dashboard shows the display numbers
  (`/api/user/me` returns them instead of the real balances table).
- Copying a trader moves display Main → display Copy. Daily profit applies
  to the display Copy balance (same 10% / 22-day schedule) and is split
  across the user's active copies so each copy shows its own profit.
- Showcase accounts hold no real balances, no real transactions, and no
  real daily-PnL rows. Every admin query filters them out with
  `is_showcase = 0` — keep that filter on any new admin query you write.
- Showcase users cannot be deleted through the real-user delete route, and
  real users cannot be edited through the showcase routes.

## Deposits & Withdrawals — Pending Flow

- When a user submits a deposit or a withdraw, a `transactions` row is
  created immediately with `status = 'pending'`. The user sees it in
  History (orange Pending badge) and on the Dashboard ("Pending Approval").
- The admin approving flips that same row to `completed` (deposit credits
  Main; withdraw is marked paid). Rejecting flips it to `rejected` and, for
  a withdraw, refunds the amount to the user's balance.
- History totals (Total In / Out / Balance) count **completed** rows only,
  so pending money never inflates the balance before approval.

## Change Settings from Admin

- Profit schedule: Admin → Profit System → Generate / Manual Edit
- Fees/minimums: Admin → Money Settings (Super Admin, audit-logged)
- Deposit wallet/QR: Admin → Deposit Wallet Settings
- Hero image: Admin → Home Page Manage (Site Settings/CMS → Media Library)
- KYC on/off: Admin → KYC Control (OFF at start)
- 2FA on/off: Admin → 2FA Control (both OFF at start)
- Header / Top Bar (brand name, tagline, colors, Log In / Sign Up buttons):
  Admin → Site Settings / CMS → Header / Top Bar. The footer brand follows
  the same settings. Favicon: same page → Media Library → Favicon Upload.

## Environment Variables

Copy `.env.example` to `backend/.env` and fill it in. Never commit `.env`.

| Variable | What it is |
|----------|-----------|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` / `production` |
| `SITE_URL` | Public URL of the site |
| `JWT_SECRET` | Secret for signing JWTs — long random string, never share |
| `JWT_EXPIRES_IN` | Token lifetime (`7d`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | Seed admin (first setup only; hash, never plain text) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Email server (optional; without it, email links are logged, not sent) |
| `DB_PATH` | SQLite file path, relative to `backend/` (default `./nexora-fx.db`) |
| `FINNHUB_KEY` | Finnhub API key (optional; gold price no longer depends on it) |

## Deployment

### ⚠️ Read this first — data persistence

**On Render's free plan the database file is wiped on every deploy.**
Render gives a free web service an ephemeral disk: each `git push` starts a
fresh server and the SQLite file (`nexora-fx.db`) is gone. The seed recreates
only the demo user and demo admin. **Do not deploy to Render free if real
users and real balances exist.**

To go live safely, pick one of these:

1. **VPS (recommended)** — Buy a small VPS (Ubuntu, ~$4–6/month) and a
   domain. The SQLite file lives on the server's disk at a fixed path
   (set `DB_PATH` to e.g. `/home/nexora/data/nexora-fx.db`). Deploying new
   code (`git pull` + restart) never touches that file, so users, balances,
   and showcase accounts survive every update. Point the domain's DNS A
   record at the server IP and serve HTTPS with Caddy or Nginx + Let's
   Encrypt. This is how the live site is meant to run.
2. **Render paid disk** — Upgrade the Render service to a paid instance and
   attach a persistent disk mounted at e.g. `/data`, with
   `DB_PATH=/data/nexora-fx.db`. Same guarantee, higher monthly cost.
3. **Turso (hosted SQLite)** — Move the database to Turso's cloud. This
   needs a code change: the app uses synchronous `node:sqlite` everywhere
   and Turso's client is async-only, so the database layer must be
   rewritten. Not done yet — do not attempt without planning it first.

**Rule for every update, everywhere: code and data live apart.** A deploy
replaces code files only. It never deletes, moves, or overwrites the
database file. If you are ever unsure, back up `nexora-fx.db` first.

### Render (current staging host)

`render.yaml` builds the backend (`npm install`) and starts it
(`npm run seed; npm start`). Every push to `main` auto-deploys in ~2–3
minutes. `JWT_SECRET` is generated by Render. Live URL is set in the
Render dashboard. Remember: free plan = data wiped on every deploy.

### VPS checklist (when you move to paid hosting)

- [ ] Ubuntu VPS, Node.js 22+, `git`, Caddy (or Nginx)
- [ ] Clone the repo, `cd backend && npm install`
- [ ] Create `backend/.env` from `.env.example` (real `JWT_SECRET`, SMTP if used)
- [ ] Set `DB_PATH` to a path OUTSIDE the repo (e.g. `/home/nexora/data/nexora-fx.db`)
- [ ] `npm run seed` once (creates admin + demo data), then change the admin password
- [ ] Run with PM2 (`pm2 start src/app.js --name nexora-fx`) so it restarts on reboot
- [ ] Caddy reverse-proxy to `localhost:3000` with automatic HTTPS for your domain
- [ ] Back up the `.db` file daily (cron copy to a second location)

## Updating the Site Safely

1. **Bump the cache version.** Every `<script src="...?v=vXX">` in
   `frontend/index.html` and `frontend/admin.html` carries the same version
   (`v58` right now). Change it to the next number on EVERY release, or
   users' browsers will keep serving the old JavaScript.
2. **Never touch the database file in a deploy.** See [Deployment](#deployment).
3. **Test before you ship.** Start the server locally, log in as the demo
   user and the admin, and click through the screen you changed. Do not call
   untested code "tested".
4. **This zip is the handover artifact.** After any change, rebuild the zip
   from this repo with a NEW file name (`nexora-fx-ready-v14.zip`, v15, … —
   never reuse a name, browsers cache the old file). The zip contains the
   full source, a fresh `.env` template, and `START.bat`; it never contains
   `node_modules` or any `.db` file.

## Email (SMTP)

If SMTP is not configured, verify/reset links are logged to console (dev only).
Users see "Email is not configured — contact admin" in production.
Password reset without SMTP also works via the admin: the user sends a
"Forget Request" from the login page and the admin issues a one-time
8-digit code from Admin → Forget Requests.

## Admin Login Path

Set in `backend/src/config/admin.js` — import `ADMIN_LOGIN_PATH` everywhere, never hard-code.

## Honest Limits

- Binance Pay = manual TxID approval only (no webhook)
- USDT BEP20 withdraw = manual admin queue (no auto-payout)
- Payment Gateways "Add New" creates a Deactivated row only
- New payment method or chart type needs code changes
- Live gold price comes from TradingView (OANDA:XAUUSD) with PAXG/server
  fallbacks; BTC comes from the Binance stream. If those sources are down,
  the hero shows the last cached price.

## Known: node:sqlite

Uses Node.js built-in `node:sqlite` (available in Node 22+).
`db.transaction()` is shimmed since node:sqlite doesn't have it natively.
See `backend/src/models/database.js`.

## Do NOT go live with

- Sample/seed data or demo passwords
- Placeholder JWT_SECRET
- Missing SMTP config without telling users
- The site on Render's free plan (data loss on every deploy — see above)

See `.env.example` for all required environment variables.
