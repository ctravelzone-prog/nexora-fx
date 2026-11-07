// livePush.js — instant notifications over a WebSocket "live connection".
//
// Who uses it:
// - The Android app (v1.5) holds a persistent WebSocket to the site; the
//   moment a notification row is created, the server pushes it to that
//   user's phone (target 1-3 seconds).
// - The user website (Components.startLivePush) connects the same way, so
//   an admin action shows on the user's bell instantly, not after the
//   15-second bell poll.
// - The admin panel (AdminComponents.startLivePush) connects with the
//   admin JWT, so a user request (deposit, withdrawal, ticket, KYC, ...)
//   shows on the admin bell instantly, on every admin page — including
//   pages that do not auto-refresh (e.g. Users).
// The 15-minute JobScheduler poll, the 15s user bell poll and the admin
// 1s auto-refresh stay as fallbacks — if the live connection is down,
// notifications still arrive, just later.
//
// How it works:
// - WebSocket endpoint /ws/live on the SAME HTTP server (port 3000), so
//   Caddy proxies it with no extra config. Path is /ws/live only.
// - Auth: the client connects, then sends {"type":"auth","token":"<JWT>"}
//   as its first message. A user token is verified exactly like the
//   authUser guard (type 'user', user row exists and is active); an admin
//   token like the authAdmin guard (type 'admin', admins row exists).
//   No auth within 10 seconds -> the socket is closed. No token in the URL.
// - Push: a 2-second poller reads notification rows newer than their
//   watermark and sends each to its live sockets. User rows go to that
//   user's sockets only; admin rows go to EVERY connected admin (the
//   admin_notifications table has no per-admin column). The poller only
//   reads (it never touches the insert sites), and it skips each query
//   entirely when nobody of that kind is connected. Each watermark starts
//   at the current MAX(id), so old rows are never replayed after a restart.
// - Heartbeat: the server pings every 30s and drops sockets that never
//   answer (clients reconnect with backoff; a 1008 close means a dead
//   token and the client must NOT reconnect).
// - A user may be connected from several devices — each socket gets the
//   same push; the app dedups by notification id (last_seen_id).
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { getDb } = require('../models/database');

// userId -> Set of live sockets.
const clients = new Map();
// adminId -> Set of live sockets.
const adminClients = new Map();
// Max notification id already pushed (or seen at boot).
let watermark = 0;
// Max admin-notification id already pushed (or seen at boot).
let adminWatermark = 0;
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

// Admin notifications have no per-admin owner — every connected admin
// gets every new admin notification.
function sendToAdmins(obj) {
  if (adminClients.size === 0) return 0;
  const data = JSON.stringify(obj);
  let n = 0;
  for (const set of adminClients.values()) {
    for (const ws of set) {
      if (ws.readyState === 1) { try { ws.send(data); n++; } catch (e) { /* dead socket, swept later */ } }
    }
  }
  return n;
}

// One poll tick: push every notification row newer than the watermark to
// its user's live sockets, and every admin-notification row to all live
// admin sockets. Exported for tests.
function pollOnce() {
  if (clients.size > 0) {
    let rows;
    try {
      rows = getDb().prepare(
        'SELECT id,user_id,title,message,action_url FROM notifications WHERE id>? AND is_read=0 ORDER BY id ASC LIMIT 50'
      ).all(watermark);
    } catch (e) { rows = []; }
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
  if (adminClients.size > 0) {
    let rows;
    try {
      rows = getDb().prepare(
        'SELECT id,title,message,destination_pane FROM admin_notifications WHERE id>? AND is_read=0 ORDER BY id ASC LIMIT 50'
      ).all(adminWatermark);
    } catch (e) { rows = []; }
    for (const r of rows) {
      if (r.id > adminWatermark) adminWatermark = r.id;
      sendToAdmins({
        type: 'notification',
        id: r.id,
        title: r.title,
        message: r.message,
        destination_pane: r.destination_pane || null,
      });
    }
  }
}

function attachLivePush(server) {
  // Start at the current max ids so old rows are never replayed.
  try {
    const r = getDb().prepare('SELECT MAX(id) AS m FROM notifications').get();
    watermark = (r && r.m) || 0;
  } catch (e) { watermark = 0; }
  try {
    const r = getDb().prepare('SELECT MAX(id) AS m FROM admin_notifications').get();
    adminWatermark = (r && r.m) || 0;
  } catch (e) { adminWatermark = 0; }

  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    let userId = null;
    let adminId = null;
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
      if (adminId != null) {
        const set = adminClients.get(adminId);
        if (set) { set.delete(ws); if (set.size === 0) adminClients.delete(adminId); }
      }
    };
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch (e) { return; }
      if (authed) return; // clients send nothing but the auth message
      if (msg && msg.type === 'auth' && typeof msg.token === 'string') {
        try {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
          if (payload.type === 'user') {
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
          } else if (payload.type === 'admin') {
            const admin = getDb().prepare(
              'SELECT id FROM admins WHERE id=?'
            ).get(payload.adminId);
            if (!admin) throw new Error('admin not found');
            adminId = admin.id;
            authed = true;
            clearTimeout(authTimer);
            if (!adminClients.has(adminId)) adminClients.set(adminId, new Set());
            adminClients.get(adminId).add(ws);
            try { ws.send(JSON.stringify({ type: 'ready', admin_id: adminId })); } catch (e) {}
          } else {
            throw new Error('unknown token type');
          }
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
