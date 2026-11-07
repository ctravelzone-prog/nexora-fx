// livePush.js — instant phone notifications over a WebSocket "live connection".
//
// Why this exists: the Android app (v1.5) holds a persistent WebSocket to
// the site; the moment a notification row is created, the server pushes it
// to that user's phone (target 1-3 seconds). The 15-minute JobScheduler
// poll and the on-open check stay as fallbacks — if the live connection
// is down, notifications still arrive, just later.
//
// How it works:
// - WebSocket endpoint /ws/live on the SAME HTTP server (port 3000), so
//   Caddy proxies it with no extra config. Path is /ws/live only.
// - Auth: the app connects, then sends {"type":"auth","token":"<user JWT>"}
//   as its first message. The token is verified exactly like the
//   authUser guard (type 'user', user row exists and is active). No auth
//   within 10 seconds -> the socket is closed. No token in the URL.
// - Push: a 2-second poller reads notifications newer than its watermark
//   and sends each row to every live socket of that user. The poller
//   only reads (it never touches the insert sites), and it skips the
//   query entirely when nobody is connected. The watermark starts at
//   the current MAX(id), so old rows are never replayed after a restart
//   (the app's poller/checkNow still delivers anything missed).
// - Heartbeat: the server pings every 30s and drops sockets that never
//   answer (the app's client reconnects with backoff).
// - A user may be connected from several devices — each socket gets the
//   same push; the app dedups by notification id (last_seen_id).
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { getDb } = require('../models/database');

// userId -> Set of live sockets.
const clients = new Map();
// Max notification id already pushed (or seen at boot).
let watermark = 0;
let pollTimer = null;

function sendToUser(userId, obj) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return 0;
  const data = JSON.stringify(obj);
  let n = 0;
  for (const ws of set) {
    if (ws.readyState === 1) { try { ws.send(data); n++; } catch (e) { /* dead socket, swept later */ } }
  }
  return n;
}

// One poll tick: push every notification row newer than the watermark to
// its user's live sockets. Exported for tests.
function pollOnce() {
  if (clients.size === 0) return;
  let rows;
  try {
    rows = getDb().prepare(
      'SELECT id,user_id,title,message,action_url FROM notifications WHERE id>? ORDER BY id ASC LIMIT 50'
    ).all(watermark);
  } catch (e) { return; }
  for (const r of rows) {
    if (r.id > watermark) watermark = r.id;
    sendToUser(r.user_id, {
      type: 'notification',
      id: r.id,
      title: r.title,
      message: r.message,
      action_url: r.action_url || null,
    });
  }
}

function attachLivePush(server) {
  // Start at the current max id so old rows are never replayed.
  try {
    const r = getDb().prepare('SELECT MAX(id) AS m FROM notifications').get();
    watermark = (r && r.m) || 0;
  } catch (e) { watermark = 0; }

  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    let userId = null;
    let authed = false;
    const authTimer = setTimeout(() => {
      if (!authed) { try { ws.close(1008, 'auth timeout'); } catch (e) {} }
    }, 10000);
    const drop = () => {
      clearTimeout(authTimer);
      if (userId != null) {
        const set = clients.get(userId);
        if (set) { set.delete(ws); if (set.size === 0) clients.delete(userId); }
      }
    };
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch (e) { return; }
      if (authed) return; // the app sends nothing but the auth message
      if (msg && msg.type === 'auth' && typeof msg.token === 'string') {
        try {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
          if (payload.type !== 'user') throw new Error('not a user token');
          const user = getDb().prepare(
            'SELECT id FROM users WHERE id=? AND is_active=1'
          ).get(payload.userId);
          if (!user) throw new Error('user not found');
          userId = user.id;
          authed = true;
          clearTimeout(authTimer);
          if (!clients.has(userId)) clients.set(userId, new Set());
          clients.get(userId).add(ws);
          try { ws.send(JSON.stringify({ type: 'ready', user_id: userId })); } catch (e) {}
        } catch (e) {
          try { ws.close(1008, 'bad token'); } catch (e2) {}
        }
      }
    });
    ws.on('close', drop);
    ws.on('error', drop);
  });

  // Drop sockets that stop answering pings.
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} return; }
      ws.isAlive = false;
      try { ws.ping(); } catch (e) {}
    });
  }, 30000);

  if (!pollTimer) pollTimer = setInterval(pollOnce, 2000);
  return wss;
}

module.exports = { attachLivePush, pollOnce };
