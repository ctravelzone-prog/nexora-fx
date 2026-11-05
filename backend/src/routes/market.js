// market.js — public live quotes for the landing hero cards (no auth).
// BTC: Bitstamp ticker (price with cents + 24h change from open), fallback CoinGecko.
// XAU: Yahoo GC=F (ticks every few seconds), fallback gold-api.com spot price.
// 4s server-side cache (frontend polls every 5s), so each poll gets fresh data.
// A failed source falls back to the cached value; if everything fails the
// endpoint answers 502 and the page keeps showing its sample values.
const router = require('express').Router();

let cache = null; // {at, data}
const CACHE_MS = 4000;

async function fetchJson(url, opts, timeoutMs) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs || 8000);
  try {
    const r = await fetch(url, { ...opts, signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const YAHOO_UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };

async function getQuotes() {
  // BTC price: Bitstamp (cents, ticks every few seconds). BTC 24h change:
  // CoinGecko (matches what trading apps show; Bitstamp's `open` is only the
  // UTC-midnight open, so its change looked wrong: +0.17% vs real +3.35%).
  // XAU price: gold-api.com SPOT (matches the spot price traders watch;
  // Yahoo GC=F is futures, ~$3 higher). XAU change: Yahoo GC=F.
  const [btcMain, btcFb, xauMain, xauFb] = await Promise.allSettled([
    fetchJson('https://www.bitstamp.net/api/v2/ticker/btcusd/'),
    fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'),
    fetchJson('https://api.gold-api.com/price/XAU'),
    fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d', { headers: YAHOO_UA }),
  ]);
  const data = { btc: null, xau: null, updatedAt: Date.now(), stale: {} };
  let btcPrice = null, btcChange = null;
  if (btcMain.status === 'fulfilled' && btcMain.value.last) btcPrice = parseFloat(btcMain.value.last);
  if (btcFb.status === 'fulfilled' && btcFb.value.bitcoin) {
    if (btcPrice === null) btcPrice = btcFb.value.bitcoin.usd;
    if (typeof btcFb.value.bitcoin.usd_24h_change === 'number') btcChange = btcFb.value.bitcoin.usd_24h_change;
  }
  if (btcPrice === null && btcMain.status === 'fulfilled' && btcMain.value.last) {
    const last = parseFloat(btcMain.value.last), open = parseFloat(btcMain.value.open);
    btcChange = (open > 0 ? (last - open) / open * 100 : null);
  }
  if (btcPrice !== null) data.btc = { price: btcPrice, change: btcChange };
  let xauPrice = null, xauChange = null;
  if (xauMain.status === 'fulfilled' && typeof xauMain.value.price === 'number') xauPrice = xauMain.value.price;
  if (xauFb.status === 'fulfilled') {
    const res = xauFb.value && xauFb.value.chart && xauFb.value.chart.result && xauFb.value.chart.result[0];
    const meta = res && res.meta;
    if (typeof meta.regularMarketChangePercent === 'number') xauChange = meta.regularMarketChangePercent;
    else if (typeof meta.fulldayChangePercent === 'number') xauChange = meta.fulldayChangePercent;
    // NOTE: Yahoo's price is GC=F futures (~$5 above spot) — NEVER use it as the
    // XAU price. If gold-api blinks, the cached spot price is served instead
    // (see the stale-fill in the /quotes handler), so the card can't jump 4127<->4132.
  }
  if (xauPrice !== null) data.xau = { price: xauPrice, change: xauChange };
  return data;
}

// Serves the Finnhub key (from backend .env, never from source) so the browser
// can open Finnhub's websocket directly. Empty string = no key configured,
// and the page simply keeps polling /quotes.
router.get('/config', (req, res) => {
  res.json({ finnhubKey: process.env.FINNHUB_KEY || '' });
});

router.get('/quotes', async (req, res) => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return res.json({ ...cache.data, cached: true });
  try {
    const data = await getQuotes();
    if (!data.btc && !data.xau) {
      if (cache) return res.json({ ...cache.data, cached: true, stale: { btc: true, xau: true } });
      return res.status(502).json({ error: 'Live prices unavailable right now' });
    }
    if (cache) {
      if (!data.btc && cache.data.btc) { data.btc = cache.data.btc; data.stale.btc = true; }
      if (!data.xau && cache.data.xau) { data.xau = cache.data.xau; data.stale.xau = true; }
    }
    cache = { at: now, data };
    res.json({ ...data, cached: false });
  } catch (e) {
    if (cache) return res.json({ ...cache.data, cached: true, stale: { btc: true, xau: true } });
    res.status(502).json({ error: 'Live prices unavailable right now' });
  }
});

module.exports = router;
