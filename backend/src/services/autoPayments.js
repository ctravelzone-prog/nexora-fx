// services/autoPayments.js — Auto Deposit Approve + Auto Withdrawal (v122).
// Adapted from the LearnChart FX payments.js tested pattern (BEP20 receipt
// verify, Binance Pay TxID check, failed-payment queue, exact BigInt
// amounts) — rewritten for Nexora: amounts in integer cents, variable
// deposit amounts, Main Balance credit via moneyService, the Nexora fee
// and referral rules, and the Nexora site_settings + env configuration.
//
// RAILS (deposit): Binance Pay (primary, read-only API key) and BEP20
// USDT (fallback, public BSC chain). A failed verify never auto-rejects:
// the deposit stays pending and the failure lands in payment_attempts
// for admin review — money is never silently dropped. A TxHash / Order
// ID can only ever credit once (code check + UNIQUE index on
// deposits.txid).
//
// WITHDRAWAL: after the normal request (amount deducted, row pending),
// tryAutoWithdraw runs the checks (limits, confirmed address, hot
// wallet) and, when they pass, sends via the Binance Spot withdrawal
// API. Status machine pending -> processing -> paid; the processing
// claim is atomic so a retry can never double-send. Any failure leaves
// the request pending (admin queue) with a fail_reason — the admin can
// approve it manually or reject it (refund). Showcase users never
// auto-send (display money only).
//
// CONFIG: toggles + limits + Pay ID / BSC address live in site_settings
// (admin Money Settings page, editable without redeploy). The two
// Binance API keys live in site_settings ENCRYPTED (admin panel, v123)
// with the .env as fallback — never in code, chat, the frontend or an
// API response in full. The read-only key must have ONLY "Enable
// Reading"; the withdrawal key has Withdrawals + Reading, Trading OFF.
// Both keys should be IP-whitelisted to the VPS (201.18.220.156).
const crypto = require('node:crypto');
const { getDb, getMainDb } = require('../models/database');
const H = require('./moneyHelpers');
const { applyDeposit } = require('./moneyService');
const { decryptSecret } = require('./secretStore');

// --- Fixed facts -----------------------------------------------------------
// USDT on BNB Smart Chain (BEP20): 18 decimals. The contract address is
// the ONLY identity of the token — anyone can deploy a fake "USDT".
const USDT_BEP20_CONTRACT = '0x55d398326f99059ff775485246999027b3197955';
// keccak256("Transfer(address,address,uint256)").
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org';
const BSCSCAN_API_URL = 'https://api.bscscan.com/api';
const BINANCE_API_HOSTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
];
const BEP20_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// --- Settings (site_settings = admin-editable, env = secrets only) ---------
// Placeholder defaults for the three limits (Siam sets the real values
// in Admin > Money Settings > Auto Payments). Toggles default OFF so
// nothing auto-runs until Siam configures it and turns it on.
function getAutoSettings() {
  const g = (k, d) => H.getSetting(k, d);
  return {
    autoDeposit: g('auto_deposit_enabled', '0') === '1',
    autoWithdraw: g('auto_withdraw_enabled', '0') === '1',
    binancePayRail: g('binance_pay_rail_enabled', '1') === '1',
    bep20Rail: g('bep20_rail_enabled', '1') === '1',
    dailyLimitCents: parseInt(g('auto_daily_withdraw_limit_cents', '50000'), 10),
    perTxMaxCents: parseInt(g('auto_per_tx_max_cents', '100000'), 10),
    globalCapCents: parseInt(g('auto_global_daily_cap_cents', '500000'), 10),
    binancePayId: (g('binance_pay_id', '') || '').trim(),
    bep20Address: (g('bep20_address', '') || '').trim().toLowerCase(),
    bscscanKey: (g('bscscan_key', '') || '').trim() || (process.env.BSCSCAN_API_KEY || '').trim(),
    // Binance API keys: admin panel (encrypted in DB) first, .env
    // fallback. The admin panel is how Siam sets them without SSH.
    readKey: (decryptSecret(g('binance_read_key_enc', '')) || process.env.BINANCE_READ_API_KEY || '').trim(),
    readSecret: (decryptSecret(g('binance_read_secret_enc', '')) || process.env.BINANCE_READ_API_SECRET || '').trim(),
    withdrawKey: (decryptSecret(g('binance_withdraw_key_enc', '')) || process.env.BINANCE_WITHDRAW_API_KEY || '').trim(),
    withdrawSecret: (decryptSecret(g('binance_withdraw_secret_enc', '')) || process.env.BINANCE_WITHDRAW_API_SECRET || '').trim(),
  };
}

// --- Exact decimal helpers (no float math) ---------------------------------
// "12.779836415501434" -> exact wei. Floats cannot hold 18-decimal
// values (Math.round(x * 1e18) came back 728 wei short in a live test).
function usdtToWei(amount) {
  const s = String(amount).trim();
  const [whole = '0', frac = ''] = s.split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
}
function weiToUsdtString(wei) {
  const v = BigInt(wei);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}
// Integer cents -> exact USDT decimal string ("1250" -> "12.50").
function centsToUsdt(cents) {
  const c = Math.round(Number(cents));
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

function fetchWithTimeout(url, options = {}, ms = 15000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
}
function topicToAddress(topic) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}
function isBep20Address(a) {
  return BEP20_ADDRESS_RE.test(String(a || '').trim());
}

// --- RAIL B: BEP20 receipt lookup ------------------------------------------
// BscScan first (when a key is set), public BSC JSON-RPC as the fallback
// so verification works with zero keys.
async function fetchReceipt(txHash, bscscanKey) {
  if (bscscanKey) {
    try {
      const res = await fetchWithTimeout(
        `${BSCSCAN_API_URL}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${bscscanKey}`
      );
      const json = await res.json();
      if (json && json.result) return json.result;
    } catch (err) {
      console.error('[autoPayments] bscscan receipt lookup failed:', err?.message || err);
    }
  }
  // Public BSC RPC, retried once — it can answer a transient HTML
  // error / rate-limit under rapid calls.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(BSC_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
      });
      const json = await res.json();
      if (json && json.result) return json.result;
      if (json && json.error) throw new Error('bsc rpc: ' + (json.error.message || 'error'));
      return null;
    } catch (err) {
      console.error('[autoPayments] bsc rpc receipt lookup failed:', err?.message || err);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

// Verify a BEP20 USDT payment. Returns { ok } or { ok:false, reason }.
// Reasons: bad-format | not-found | lookup-failed | failed |
// no-usdt-transfer | wrong-recipient | wrong-amount. On wrong-amount /
// wrong-recipient the result carries `detail` ({ from, to, amountUsdt })
// so the failure can be queued for admin review with the real values.
async function verifyBep20Tx({ txHash, expectedAddress, expectedAmountUsdt }) {
  const hash = String(txHash || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return { ok: false, reason: 'bad-format' };
  const { bscscanKey } = getAutoSettings();
  let receipt;
  try {
    receipt = await fetchReceipt(hash, bscscanKey);
  } catch (err) {
    console.error('[autoPayments] receipt fetch threw:', err?.message || err);
    return { ok: false, reason: 'lookup-failed' };
  }
  if (!receipt) return { ok: false, reason: 'not-found' };
  if (receipt.status !== '0x1') return { ok: false, reason: 'failed' };
  const expectedValue = usdtToWei(expectedAmountUsdt);
  const merchant = String(expectedAddress).toLowerCase();
  let sawUsdtTransfer = false;
  let sawRightRecipient = false;
  let detail = null;
  for (const log of receipt.logs || []) {
    if (String(log.address || '').toLowerCase() !== USDT_BEP20_CONTRACT) continue;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;
    sawUsdtTransfer = true;
    const to = topicToAddress(log.topics[2]);
    const value = BigInt(log.data || '0x0');
    const from = topicToAddress(log.topics[1]);
    if (!detail) detail = { from, to, amountUsdt: weiToUsdtString(value) };
    if (to === merchant) {
      sawRightRecipient = true;
      detail = { from, to, amountUsdt: weiToUsdtString(value) };
      if (value === expectedValue) return { ok: true, from, amountUsdt: expectedAmountUsdt };
    }
  }
  if (!sawUsdtTransfer) return { ok: false, reason: 'no-usdt-transfer' };
  if (!sawRightRecipient) return { ok: false, reason: 'wrong-recipient', detail };
  return { ok: false, reason: 'wrong-amount', detail };
}

// --- RAIL A: Binance Pay TxID check (read-only key) -------------------------
// Signed call to Binance Spot API Get Pay Trade History. The endpoint
// returns the key owner's OWN Pay history (recent window only), so we
// pull the window and filter in memory. api.binance.com can return HTTP
// 451 from US servers — we try all five hosts, and if ALL answer 451
// the rail fails with "geo-blocked" (an honest reason, not "try again").
// BEP20 keeps working in that case (it verifies on-chain).
async function fetchPayHistory({ apiKey, apiSecret, windowDays = 7 }) {
  const now = Date.now();
  const params = new URLSearchParams({
    timestamp: String(now),
    startTime: String(now - windowDays * 24 * 60 * 60 * 1000),
    endTime: String(now),
    limit: '100',
  });
  const query = params.toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');
  let lastError = null;
  let blocked451 = 0;
  for (const host of BINANCE_API_HOSTS) {
    try {
      const res = await fetchWithTimeout(
        `${host}/sapi/v1/pay/transactions?${query}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': apiKey } }
      );
      if (res.status === 451) {
        blocked451 += 1;
        lastError = new Error(`binance pay history HTTP 451 from ${host}`);
        continue;
      }
      if (!res.ok) throw new Error(`binance pay history HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json?.data)) throw new Error('binance pay history: unexpected response shape');
      return json.data;
    } catch (err) {
      lastError = err;
    }
  }
  if (blocked451 === BINANCE_API_HOSTS.length) {
    const err = new Error('binance pay history geo-blocked (HTTP 451 from all hosts)');
    err.code = 'GEO_BLOCKED';
    throw err;
  }
  throw lastError || new Error('binance pay history unreachable');
}

// Verify a Binance Pay payment by the Order ID the user pasted. Matches
// ONE record: Order ID, currency USDT, amount EXACT (BigInt compare, no
// float), incoming to our Pay ID when the record names a receiver.
// Reasons: bad-format | not-configured | api-error | geo-blocked |
// not-found.
async function verifyBinancePayTx({ orderId, expectedAmountUsdt }) {
  const id = String(orderId || '').trim();
  if (!id) return { ok: false, reason: 'bad-format' };
  const cfg = getAutoSettings();
  if (!cfg.readKey || !cfg.readSecret) return { ok: false, reason: 'not-configured' };
  let history;
  try {
    history = await fetchPayHistory({ apiKey: cfg.readKey, apiSecret: cfg.readSecret });
  } catch (err) {
    console.error('[autoPayments] binance pay history failed:', err?.message || err);
    if (err?.code === 'GEO_BLOCKED') return { ok: false, reason: 'geo-blocked' };
    return { ok: false, reason: 'api-error' };
  }
  const expectedValue = usdtToWei(expectedAmountUsdt);
  for (const item of history) {
    const candidates = [item.transactionId, item.orderId].filter(Boolean).map(String);
    if (!candidates.includes(id)) continue;
    if (String(item.currency || '').toUpperCase() !== 'USDT') continue;
    try {
      if (usdtToWei(String(item.amount)) !== expectedValue) continue;
    } catch (_) {
      continue;
    }
    if (cfg.binancePayId && item.receiverInfo && typeof item.receiverInfo === 'object') {
      const values = Object.values(item.receiverInfo).map((v) => String(v).toLowerCase());
      if (values.length > 0 && !values.includes(cfg.binancePayId.toLowerCase())) continue;
    }
    return { ok: true, amountUsdt: expectedAmountUsdt, transactionTime: item.transactionTime };
  }
  return { ok: false, reason: 'not-found' };
}

// --- Failed-verify queue (never silently lost) ------------------------------
function recordPaymentAttempt({ userId, method, txRef, reason, expectedAmountCents, detail }) {
  const db = getMainDb();
  try {
    db.prepare(
      "INSERT OR IGNORE INTO payment_attempts (user_id, method, tx_ref, reason, expected_amount_cents, detail, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    ).run(
      userId, method, String(txRef || '').trim(), reason,
      expectedAmountCents == null ? null : expectedAmountCents,
      detail ? JSON.stringify(detail) : ''
    );
  } catch (err) {
    console.error('[autoPayments] recordPaymentAttempt failed:', err?.message || err);
  }
}

// Has this reference already credited a deposit? The UNIQUE index on
// deposits.txid is the race backstop; this is the friendly check.
function isTxRefUsed(txRef, db) {
  const row = (db || getDb()).prepare('SELECT id FROM deposits WHERE txid=?').get(String(txRef || '').trim());
  return Boolean(row);
}

// --- Auto deposit orchestrator ----------------------------------------------
// Called after the deposit row is created (pending). Returns
// { auto:true } when the deposit was verified + credited, or
// { auto:false, reason } when it stays pending for manual review.
// Reasons: auto-off | rail-off | showcase | not-configured | duplicate |
// bad-format | not-found | lookup-failed | failed | no-usdt-transfer |
// wrong-recipient | wrong-amount | api-error | geo-blocked.
async function tryAutoDeposit({ userId, depositId, method, txRef, amountCents, db }) {
  const udb = db || getDb();
  const u = udb.prepare('SELECT is_showcase FROM users WHERE id=?').get(userId);
  if (u && u.is_showcase === 1) return { auto: false, reason: 'showcase' };
  const cfg = getAutoSettings();
  if (!cfg.autoDeposit) return { auto: false, reason: 'auto-off' };
  if (method === 'bep20' && !cfg.bep20Rail) return { auto: false, reason: 'rail-off' };
  if (method === 'binance_pay' && !cfg.binancePayRail) return { auto: false, reason: 'rail-off' };
  if (isTxRefUsed(txRef, udb)) {
    // The row we just created IS this txRef — only treat it as a
    // duplicate when another deposit already carries it.
    const others = udb.prepare('SELECT id FROM deposits WHERE txid=? AND id<>?').get(String(txRef).trim(), depositId);
    if (others) return { auto: false, reason: 'duplicate' };
  }
  const expectedUsdt = centsToUsdt(amountCents);
  let result;
  if (method === 'bep20') {
    if (!cfg.bep20Address) return { auto: false, reason: 'not-configured' };
    result = await verifyBep20Tx({ txHash: txRef, expectedAddress: cfg.bep20Address, expectedAmountUsdt: expectedUsdt });
  } else {
    if (!cfg.readKey || !cfg.readSecret) return { auto: false, reason: 'not-configured' };
    result = await verifyBinancePayTx({ orderId: txRef, expectedAmountUsdt: expectedUsdt });
  }
  if (!result.ok) {
    recordPaymentAttempt({ userId, method, txRef, reason: result.reason, expectedAmountCents: amountCents, detail: result.detail });
    return { auto: false, reason: result.reason, detail: result.detail };
  }
  // Verified: credit Main Balance via the same path as a manual approval
  // (referral 4% on first deposit, notifications, ledger). approved_by 0
  // means "system / auto" — no admin approved it.
  applyDeposit(userId, depositId, amountCents, 0);
  try {
    udb.prepare('UPDATE deposits SET auto=1, verified_detail=? WHERE id=?').run(JSON.stringify({ method, verified: result, at: Math.floor(Date.now() / 1000) }), depositId);
  } catch (_) {}
  return { auto: true };
}

// --- Binance Spot withdrawal ------------------------------------------------
// Signed POST /sapi/v1/capital/withdraw/apply (coin USDT, network BSC).
// Returns { ok:true, id } or { ok:false, reason, message }.
async function binanceWithdraw({ address, amountUsdt }) {
  const cfg = getAutoSettings();
  if (!cfg.withdrawKey || !cfg.withdrawSecret) return { ok: false, reason: 'not-configured' };
  const params = new URLSearchParams({
    coin: 'USDT', network: 'BSC', address: String(address).trim(),
    amount: String(amountUsdt), timestamp: String(Date.now()),
  });
  const query = params.toString();
  const signature = crypto.createHmac('sha256', cfg.withdrawSecret).update(query).digest('hex');
  let lastError = null;
  for (const host of BINANCE_API_HOSTS) {
    try {
      const res = await fetchWithTimeout(
        `${host}/sapi/v1/capital/withdraw/apply?${query}&signature=${signature}`,
        { method: 'POST', headers: { 'X-MBX-APIKEY': cfg.withdrawKey } }
      );
      const json = await res.json().catch(() => null);
      if (res.status === 451) { lastError = new Error('geo-blocked (HTTP 451)'); continue; }
      if (!res.ok || !json || !json.id) {
        return { ok: false, reason: 'api-error', message: (json && (json.msg || JSON.stringify(json))) || `HTTP ${res.status}` };
      }
      return { ok: true, id: String(json.id) };
    } catch (err) {
      lastError = err;
    }
  }
  return { ok: false, reason: 'api-error', message: lastError ? lastError.message : 'unreachable' };
}

// Spot USDT free balance on the withdrawal key's account (the money the
// auto-send can actually move). Returns a number (USDT) or null when the
// lookup itself fails — callers treat null as "unknown, try the send".
async function getHotWalletBalance() {
  const cfg = getAutoSettings();
  if (!cfg.withdrawKey || !cfg.withdrawSecret) return null;
  const params = new URLSearchParams({ timestamp: String(Date.now()) });
  const query = params.toString();
  const signature = crypto.createHmac('sha256', cfg.withdrawSecret).update(query).digest('hex');
  for (const host of BINANCE_API_HOSTS) {
    try {
      const res = await fetchWithTimeout(
        `${host}/api/v3/account?${query}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': cfg.withdrawKey } }
      );
      if (res.status === 451) continue;
      if (!res.ok) return null;
      const json = await res.json();
      const row = (json.balances || []).find((b) => b.asset === 'USDT');
      return row ? parseFloat(row.free || '0') : 0;
    } catch (_) {
      return null;
    }
  }
  return null;
}

// --- Address confirmation (app-level whitelist) -----------------------------
// A payout address must be confirmed before auto-send can use it. A
// first withdrawal to a new address stays pending for admin review; when
// the admin approves it, the address is confirmed for future auto-sends.
// A past PAID withdrawal to the address counts as confirmed (pre-v122
// history), so existing users are not blocked.
function isAddressConfirmed(db, userId, address) {
  const a = String(address || '').trim().toLowerCase();
  if (!a) return false;
  const row = db.prepare('SELECT confirmed FROM user_addresses WHERE user_id=? AND address=?').get(userId, a);
  if (row && row.confirmed === 1) return true;
  const paid = db.prepare(`SELECT id FROM withdrawals WHERE user_id=? AND LOWER(wallet_address)=? AND status='paid' LIMIT 1`).get(userId, a);
  if (paid) {
    try { db.prepare('INSERT OR IGNORE INTO user_addresses (user_id,address,confirmed) VALUES (?,?,1)').run(userId, a); } catch (_) {}
    return true;
  }
  return false;
}
function confirmAddress(db, userId, address) {
  const a = String(address || '').trim().toLowerCase();
  if (!a) return;
  try {
    db.prepare('INSERT INTO user_addresses (user_id,address,confirmed) VALUES (?,?,1) ON CONFLICT(user_id,address) DO UPDATE SET confirmed=1').run(userId, a);
  } catch (_) {}
}

// --- Daily totals (Dhaka calendar day) --------------------------------------
function dhakaDayStartSec(nowSec) {
  const d = nowSec + 21600;
  return Math.floor(d / 86400) * 86400 - 21600;
}
function dailyUserTotal(db, userId) {
  const start = dhakaDayStartSec(Math.floor(Date.now() / 1000));
  const row = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS t FROM withdrawals WHERE user_id=? AND created_at>=? AND status IN ('paid','processing')`).get(userId, start);
  return row ? row.t : 0;
}
function dailyGlobalTotal() {
  const db = getMainDb();
  const start = dhakaDayStartSec(Math.floor(Date.now() / 1000));
  const row = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS t FROM withdrawals WHERE created_at>=? AND status IN ('paid','processing')`).get(start);
  return row ? row.t : 0;
}

// --- Auto withdrawal orchestrator -------------------------------------------
// Called after the withdrawal row is created (pending, amount already
// deducted). Returns { auto:true, txId } when Binance accepted the send,
// or { auto:false, reason } when the request stays pending for manual
// review. Reasons: auto-off | showcase | not-configured | not-pending |
// bad-address | new-address | over-deposit-cap |
// over-per-tx-max | over-daily-limit | over-global-cap |
// insufficient-hot-wallet | already-processing | api-error | geo-blocked.
async function tryAutoWithdraw(withdrawalId, db) {
  const udb = db || getDb();
  const wd = udb.prepare('SELECT * FROM withdrawals WHERE id=?').get(withdrawalId);
  if (!wd || wd.status !== 'pending') return { auto: false, reason: 'not-pending' };
  const u = udb.prepare('SELECT is_showcase FROM users WHERE id=?').get(wd.user_id);
  if (u && u.is_showcase === 1) return { auto: false, reason: 'showcase' };
  const cfg = getAutoSettings();
  if (!cfg.autoWithdraw) return { auto: false, reason: 'auto-off' };
  if (!cfg.withdrawKey || !cfg.withdrawSecret) return { auto: false, reason: 'not-configured' };
  const fail = (reason) => {
    try { udb.prepare('UPDATE withdrawals SET fail_reason=?, updated_at=unixepoch() WHERE id=?').run(reason, withdrawalId); } catch (_) {}
    return { auto: false, reason };
  };
  // Withdrawal caps (v122, defence in depth): a Main withdrawal can
  // never exceed the user's total deposited (lifetime counter, so it is
  // re-checked here). A Profit withdrawal can never exceed the Profit
  // Balance (Total PnL) — that cap is enforced at request time in
  // requestProfitWithdraw, so an over-PnL profit request is never
  // created and can never reach auto-approval.
  if (wd.type === 'main') {
    const cap = udb.prepare('SELECT total_deposited_cents FROM balances WHERE user_id=?').get(wd.user_id);
    if (cap && wd.amount_cents > (cap.total_deposited_cents || 0)) return fail('over-deposit-cap');
  }
  if (!isBep20Address(wd.wallet_address)) return fail('bad-address');
  if (!isAddressConfirmed(udb, wd.user_id, wd.wallet_address)) return fail('new-address');
  if (wd.amount_cents > cfg.perTxMaxCents) return fail('over-per-tx-max');
  if (dailyUserTotal(udb, wd.user_id) + wd.amount_cents > cfg.dailyLimitCents) return fail('over-daily-limit');
  if (dailyGlobalTotal() + wd.amount_cents > cfg.globalCapCents) return fail('over-global-cap');
  // Hot wallet: only a successful lookup can block the send. When the
  // lookup itself fails, the send below is the real test.
  const hot = await getHotWalletBalance();
  const netUsdt = centsToUsdt(wd.net_cents);
  if (hot !== null && hot < parseFloat(netUsdt)) return fail('insufficient-hot-wallet');
  // Atomic claim: pending -> processing. A retry that finds the row
  // already claimed (0 rows changed) can never double-send.
  const claimed = udb.prepare(`UPDATE withdrawals SET status='processing', updated_at=unixepoch() WHERE id=? AND status='pending'`).run(withdrawalId);
  if (!claimed.changes) return { auto: false, reason: 'already-processing' };
  const sent = await binanceWithdraw({ address: wd.wallet_address, amountUsdt: netUsdt });
  if (!sent.ok) {
    try { udb.prepare(`UPDATE withdrawals SET status='pending', fail_reason=?, updated_at=unixepoch() WHERE id=?`).run(sent.reason || 'api-error', withdrawalId); } catch (_) {}
    return { auto: false, reason: sent.reason || 'api-error', message: sent.message };
  }
  // Paid: mark the withdrawal + History row completed, add to the
  // withdrawn total, and notify the user — the same outcome as a manual
  // admin approval (see withdrawService.processWithdrawal).
  udb.transaction(() => {
    udb.prepare(`UPDATE withdrawals SET status='paid', tx_hash=?, auto=1, fail_reason=NULL, updated_at=unixepoch() WHERE id=?`).run(sent.id, withdrawalId);
    udb.prepare(`UPDATE transactions SET status='completed' WHERE reference=?`).run(`WD-${withdrawalId}`);
    udb.prepare('UPDATE balances SET total_withdrawn_cents=total_withdrawn_cents+?,updated_at=unixepoch() WHERE user_id=?').run(wd.net_cents, wd.user_id);
    const kind = wd.type === 'profit' ? 'Profit' : 'Main';
    const msg = wd.fee_cents > 0
      ? `Your $${H.fmtC(wd.amount_cents)} ${kind} withdrawal has been paid automatically. Fee $${H.fmtC(wd.fee_cents)} deducted, you received $${H.fmtC(wd.net_cents)}. Binance withdrawal ID: ${sent.id}.`
      : `Your $${H.fmtC(wd.amount_cents)} ${kind} withdrawal has been paid automatically. No fee — you received $${H.fmtC(wd.net_cents)}. Binance withdrawal ID: ${sent.id}.`;
    udb.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(wd.user_id, 'Withdrawal paid', msg, 'success');
  })();
  return { auto: true, txId: sent.id };
}

module.exports = {
  USDT_BEP20_CONTRACT, TRANSFER_TOPIC,
  usdtToWei, weiToUsdtString, centsToUsdt, isBep20Address,
  getAutoSettings, verifyBep20Tx, verifyBinancePayTx,
  recordPaymentAttempt, isTxRefUsed,
  tryAutoDeposit, tryAutoWithdraw,
  isAddressConfirmed, confirmAddress,
  dailyUserTotal, dailyGlobalTotal, dhakaDayStartSec,
};
