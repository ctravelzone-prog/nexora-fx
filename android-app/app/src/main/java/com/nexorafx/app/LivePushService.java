package com.nexorafx.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import javax.net.ssl.SSLSocketFactory;

// Live push (v1.5): a foreground service that holds a persistent secure
// WebSocket to the site and shows each notification the moment it is
// sent (target 1-3 seconds), instead of waiting for the 15-minute poll.
// No Firebase — the app uses only framework APIs, so the WebSocket
// client here is hand-written (java.net.Socket + the WS handshake and
// framing); the server side is the `ws` package on /ws/live.
//
// How it works:
// - The service connects to wss://nexorafx.us/ws/live, sends
//   {"type":"auth","token":"<user JWT>"} first (the token is never in
//   the URL), and waits for {"type":"ready"}. The server pushes
//   {"type":"notification", id, title, message, action_url} rows.
// - Each push is shown via NotificationHelper.noteLiveNotification,
//   which also advances last_seen_id so the 15-minute poller never
//   posts the same row twice.
// - The connection is kept alive with pings; any drop reconnects with
//   backoff (2s, 5s, 10s, 30s, 60s). The service restarts itself if
//   the system kills it (START_STICKY) and after a phone restart
//   (BootReceiver).
// - Android requires a persistent notification for a foreground
//   service — the "Nexora FX live" notification below. It is quiet
//   (IMPORTANCE_LOW) and tapping it opens the app. Battery optimisation
//   can still pause the service, like any background work.
public class LivePushService extends Service {

    private static final String WS_HOST = "nexorafx.us";
    private static final String WS_PATH = "/ws/live";
    private static final int FOREGROUND_ID = 2001;
    private static final String LIVE_CHANNEL_ID = "nexora_live";
    private static final int[] BACKOFF_MS = {2000, 5000, 10000, 30000, 60000};

    private volatile boolean stopped = false;
    private volatile Socket socket = null;
    private volatile int lastCloseCode = 0;
    private Thread worker;

    // Start (or restart) the live service. Safe to call on every app
    // launch and after every fresh login — starting an already-running
    // service just delivers a new intent to it.
    public static void start(Context ctx) {
        Intent i = new Intent(ctx, LivePushService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createLiveChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(FOREGROUND_ID, foregroundNotification());
        if (worker == null || !worker.isAlive()) {
            stopped = false;
            worker = new Thread(this::runLoop);
            worker.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopped = true;
        closeSocket();
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createLiveChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(
                LIVE_CHANNEL_ID, "Nexora FX live", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Keeps notifications instant while the live connection runs");
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    private Notification foregroundNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, LIVE_CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        return b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Nexora FX live")
                .setContentText("Notifications arrive instantly")
                .setContentIntent(pi)
                .build();
    }

    private void closeSocket() {
        Socket s = socket;
        socket = null;
        if (s != null) { try { s.close(); } catch (Exception ignored) {} }
    }

    // Main loop: connect, authenticate, read pushes, reconnect on drop.
    private void runLoop() {
        int failures = 0;
        while (!stopped) {
            String token = NotificationHelper.prefs(this).getString(NotificationHelper.KEY_TOKEN, null);
            if (token == null || token.isEmpty()) {
                // Not logged in (yet) — wait, then try again. MainActivity
                // also restarts this service right after a fresh login.
                sleepQuietly(30000);
                continue;
            }
            try {
                runConnection(token);
                failures = 0; // a clean close after a good run resets backoff
            } catch (Exception ignored) {
                if (lastCloseCode == 1008) {
                    // The server closed us for auth (bad/expired token, or
                    // the account was deactivated). The token is dead — clear
                    // it and stop; MainActivity restarts this service on the
                    // next login, instead of reconnecting forever with it.
                    NotificationHelper.prefs(this).edit()
                            .remove(NotificationHelper.KEY_TOKEN).apply();
                    stopSelf();
                    return;
                }
            }
            if (stopped) break;
            int backoff = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
            failures++;
            sleepQuietly(backoff);
        }
    }

    private void sleepQuietly(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
    }

    // One connection: handshake, auth, then read frames until it drops.
    private void runConnection(String token) throws Exception {
        lastCloseCode = 0;
        SSLSocketFactory f = (SSLSocketFactory) SSLSocketFactory.getDefault();
        Socket s = f.createSocket(WS_HOST, 443);
        socket = s;
        s.setSoTimeout(45000); // a dead socket is noticed within 45s
        OutputStream out = s.getOutputStream();
        InputStream in = s.getInputStream();

        byte[] keyBytes = new byte[16];
        new SecureRandom().nextBytes(keyBytes);
        String key = Base64.getEncoder().encodeToString(keyBytes);
        String req = "GET " + WS_PATH + " HTTP/1.1\r\n"
                + "Host: " + WS_HOST + "\r\n"
                + "Upgrade: websocket\r\n"
                + "Connection: Upgrade\r\n"
                + "Sec-WebSocket-Key: " + key + "\r\n"
                + "Sec-WebSocket-Version: 13\r\n\r\n";
        out.write(req.getBytes(StandardCharsets.US_ASCII));
        out.flush();
        // Read the 101 response headers.
        StringBuilder head = new StringBuilder();
        int c;
        while (!stopped) {
            c = in.read();
            if (c < 0) throw new java.io.IOException("closed during handshake");
            head.append((char) c);
            if (head.length() >= 4 && head.substring(head.length() - 4).equals("\r\n\r\n")) break;
        }
        if (!head.toString().contains(" 101 ")) throw new java.io.IOException("no 101 upgrade");
        // Authenticate first — the server closes unauthenticated sockets.
        sendText(out, "{\"type\":\"auth\",\"token\":\"" + token.replace("\"", "") + "\"}");
        long lastPingAt = System.currentTimeMillis();
        StringBuilder frag = new StringBuilder();
        while (!stopped) {
            int b0;
            try {
                b0 = in.read();
            } catch (java.net.SocketTimeoutException e) {
                // Nothing arrived for 45s — send a ping to check the line.
                sendPing(out);
                lastPingAt = System.currentTimeMillis();
                continue;
            }
            if (b0 < 0) throw new java.io.IOException("socket closed");
            int b1 = in.read();
            if (b1 < 0) throw new java.io.IOException("socket closed");
            int op = b0 & 0x0F;
            boolean fin = (b0 & 0x80) != 0;
            boolean masked = (b1 & 0x80) != 0;
            long len = b1 & 0x7F;
            if (len == 126) len = (readByte(in) << 8) | readByte(in);
            else if (len == 127) {
                len = 0;
                for (int i = 0; i < 8; i++) len = (len << 8) | readByte(in);
            }
            byte[] mask = null;
            if (masked) {
                mask = new byte[4];
                readFully(in, mask, 4);
            }
            byte[] payload = new byte[(int) len];
            readFully(in, payload, (int) len);
            if (mask != null) {
                for (int i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            }
            if (op == 9) { // ping -> pong with the same payload
                sendFrame(out, 10, payload);
            } else if (op == 10) { // pong -> connection is alive
                lastPingAt = System.currentTimeMillis();
            } else if (op == 8) { // close -> answer, then reconnect
                if (payload.length >= 2) {
                    lastCloseCode = ((payload[0] & 0xFF) << 8) | (payload[1] & 0xFF);
                }
                try { sendFrame(out, 8, new byte[0]); } catch (Exception ignored) {}
                throw new java.io.IOException("server closed");
            } else if (op == 1) { // text
                frag.append(new String(payload, StandardCharsets.UTF_8));
                if (fin) {
                    String text = frag.toString();
                    frag.setLength(0);
                    handleMessage(text);
                }
            } else if (op == 2) { // binary — the server never sends it
                frag.setLength(0);
            }
            // Keep the line warm: ping at least every 30s.
            if (System.currentTimeMillis() - lastPingAt > 30000) {
                sendPing(out);
                lastPingAt = System.currentTimeMillis();
            }
        }
    }

    private int readByte(InputStream in) throws Exception {
        int b = in.read();
        if (b < 0) throw new java.io.IOException("socket closed");
        return b;
    }

    private void readFully(InputStream in, byte[] buf, int n) throws Exception {
        int off = 0;
        while (off < n) {
            int r = in.read(buf, off, n - off);
            if (r < 0) throw new java.io.IOException("socket closed");
            off += r;
        }
    }

    // One pushed notification -> the notification bar (deduped against
    // the 15-minute poller by last_seen_id).
    private void handleMessage(String text) {
        try {
            org.json.JSONObject j = new org.json.JSONObject(text);
            if (!"notification".equals(j.optString("type"))) return;
            NotificationHelper.noteLiveNotification(this,
                    (int) j.optLong("id", 0),
                    j.optString("title", "Nexora FX"),
                    j.optString("message", ""),
                    j.optString("action_url", null));
        } catch (Exception ignored) {
            // Not a notification (e.g. the "ready" message) — ignore.
        }
    }

    // Client frames must be masked (RFC 6455). Builds one frame.
    private void sendFrame(OutputStream out, int opcode, byte[] payload) throws Exception {
        byte[] mask = new byte[4];
        new SecureRandom().nextBytes(mask);
        java.io.ByteArrayOutputStream f = new java.io.ByteArrayOutputStream();
        f.write(0x80 | opcode);
        int len = payload.length;
        if (len < 126) {
            f.write(0x80 | len);
        } else if (len <= 0xFFFF) {
            f.write(0x80 | 126);
            f.write((len >> 8) & 0xFF);
            f.write(len & 0xFF);
        } else {
            f.write(0x80 | 127);
            for (int i = 7; i >= 0; i--) f.write((int) ((len >> (8 * i)) & 0xFF));
        }
        f.write(mask);
        for (int i = 0; i < len; i++) f.write(payload[i] ^ mask[i % 4]);
        out.write(f.toByteArray());
        out.flush();
    }

    private void sendText(OutputStream out, String text) throws Exception {
        sendFrame(out, 1, text.getBytes(StandardCharsets.UTF_8));
    }

    private void sendPing(OutputStream out) throws Exception {
        sendFrame(out, 9, new byte[0]);
    }
}
