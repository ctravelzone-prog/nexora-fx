// routes/track.js — built-in website visitor analytics (v116).
// POST /visit records one page view in the main DB. The frontend sends a
// random per-device visitor_id (cookie + localStorage); distinct IDs are
// unique visitors, so one device is counted once no matter how often it
// visits. Bots and scripts (no User-Agent or a bot UA) are not recorded.
// No personal data is collected: no IP, no account link, just the random
// ID, the page path and the time. The general /api rate limiter applies,
// so the endpoint cannot be flooded to inflate the numbers.
const router = require('express').Router();
const { getMainDb } = require('../models/database');
const BOT_RE = /bot|spider|crawler|slurp|mediapartners|adsbot|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|headless|phantomjs|selenium|curl|wget|python-requests|httpclient|axios|node-fetch|postman|go-http-client|java\//i;
router.post('/visit', (req, res) => {
  try {
    const ua = req.get('user-agent') || '';
    if (!ua || BOT_RE.test(ua)) return res.json({ success: true, skipped: true });
    const vid = typeof req.body?.visitor_id === 'string' ? req.body.visitor_id.trim().slice(0, 64) : '';
    let path = typeof req.body?.path === 'string' ? req.body.path.trim().slice(0, 200) : '/';
    if (!vid || !path.startsWith('/')) return res.status(400).json({ error: 'Invalid visit' });
    getMainDb().prepare('INSERT INTO visits (visitor_id, path, visited_at) VALUES (?, ?, unixepoch())').run(vid, path);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Could not record visit' }); }
});
module.exports = router;
