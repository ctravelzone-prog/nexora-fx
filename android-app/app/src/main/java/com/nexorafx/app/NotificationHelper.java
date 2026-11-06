package com.nexorafx.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

// Shared helpers for Nexora FX phone notifications (v1.3).
//
// How notifications work in this app (no Firebase — see README):
// the site already creates a notification row for every important event
// (deposit approved/rejected, withdrawal, KYC, support reply, admin
// message, daily profit). The app polls GET /api/user/notifications
// every 15 minutes (JobScheduler) with the user's login token and shows
// each NEW row as a phone notification. Tapping one opens the app on
// that notification's page.
public class NotificationHelper {

    public static final String BASE_URL = "https://nexorafx.us";
    public static final String CHANNEL_ID = "nexora_notifications";
    public static final int JOB_ID = 1001;
    // 15 minutes — the JobScheduler minimum. A notification can arrive
    // up to ~15 minutes after the event, not instantly.
    public static final long POLL_INTERVAL_MS = 15 * 60 * 1000;
    public static final String PREFS = "nexora_notify";
    public static final String KEY_TOKEN = "auth_token";
    public static final String KEY_LAST_SEEN_ID = "last_seen_id";
    // App-update check (v1.3): pending update found by the poller.
    public static final String KEY_UPDATE_CODE = "pending_update_code";
    public static final String KEY_UPDATE_URL = "pending_update_url";
    public static final String KEY_UPDATE_NAME = "pending_update_name";
    public static final String KEY_UPDATE_DISMISSED = "update_dismissed_code";
    public static final String KEY_LAST_UPDATE_NOTIFIED = "last_update_notified_code";
    public static final String KEY_DOWNLOAD_ID = "update_download_id";
    // Notification id for the update alert (far above any row id).
    public static final int UPDATE_NOTIFICATION_ID = 999001;

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // Notification channel (Android 8+). Safe to call on every launch.
    public static void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Nexora FX", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Deposit, withdrawal, profit and account notifications");
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    // v1.4.2: immediate check (the 15-min job alone made notifications
    // arrive up to 15 min late — a deposit reject showed nothing until
    // the next job tick). The app checks when it opens, when it comes
    // back to the foreground, and right after a fresh login syncs a
    // token. Throttled to once a minute for plain opens/resumes so page
    // loads don't hammer the server; a fresh login bypasses the throttle.
    public static final String KEY_LAST_CHECK_AT = "last_check_at";
    private static final Object CHECK_LOCK = new Object();

    public static void checkNow(Context ctx) { checkNow(ctx, false); }

    public static void checkNow(Context ctx, boolean force) {
        SharedPreferences p = prefs(ctx);
        long now = System.currentTimeMillis();
        if (!force && now - p.getLong(KEY_LAST_CHECK_AT, 0) < 60 * 1000) return;
        p.edit().putLong(KEY_LAST_CHECK_AT, now).apply();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> { try { runCheck(app); } catch (Exception ignored) {} }).start();
    }

    // Same check the 15-min job runs: update check + new notification
    // rows -> phone notifications. Synchronized so an immediate check
    // and a job tick can't post the same row twice.
    public static void runCheck(Context ctx) throws Exception {
        synchronized (CHECK_LOCK) {
            checkForUpdate(ctx);
            SharedPreferences prefs = prefs(ctx);
            String token = prefs.getString(KEY_TOKEN, null);
            if (token == null || token.isEmpty()) return; // not logged in yet
            long lastSeen = prefs.getLong(KEY_LAST_SEEN_ID, 0);

            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(
                    BASE_URL + "/api/user/notifications").openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Accept", "application/json");
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            int code = c.getResponseCode();
            if (code == 401) {
                // Token expired (user tokens last 7 days) — clear it; the next
                // app open syncs a fresh one from the WebView.
                prefs.edit().remove(KEY_TOKEN).apply();
                return;
            }
            if (code != 200) return;
            String body = readAll(c.getInputStream());
            c.disconnect();

            org.json.JSONArray arr = new org.json.JSONObject(body).optJSONArray("notifications");
            if (arr == null) return;
            // Rows come newest-first; collect the new ones (id > lastSeen).
            java.util.List<org.json.JSONObject> fresh = new java.util.ArrayList<>();
            long maxId = lastSeen;
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject n = arr.optJSONObject(i);
                if (n == null) continue;
                long id = n.optLong("id", 0);
                if (id > maxId) maxId = id;
                if (id > lastSeen) fresh.add(n);
            }
            if (fresh.isEmpty()) {
                if (maxId > lastSeen) prefs.edit().putLong(KEY_LAST_SEEN_ID, maxId).apply();
                return;
            }
            // Oldest first, newest 5 at most (avoid a flood after a long absence).
            int start = Math.max(0, fresh.size() - 5);
            for (int i = fresh.size() - 1; i >= start; i--) {
                org.json.JSONObject n = fresh.get(i);
                postNotification(ctx,
                        (int) n.optLong("id", 0),
                        n.optString("title", "Nexora FX"),
                        n.optString("message", ""),
                        n.optString("action_url", null));
            }
            prefs.edit().putLong(KEY_LAST_SEEN_ID, maxId).apply();
        }
    }

    // Asks the server which app version is current. If a newer one
    // exists, remembers it (so the app shows the update dialog on
    // launch) and notifies once per version.
    private static void checkForUpdate(Context ctx) {
        try {
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(
                    BASE_URL + "/api/app/version").openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Accept", "application/json");
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            if (c.getResponseCode() != 200) return;
            String body = readAll(c.getInputStream());
            c.disconnect();
            org.json.JSONObject j = new org.json.JSONObject(body);
            int serverCode = j.optInt("version_code", 0);
            if (serverCode <= 0) return;
            int ownCode = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionCode;
            if (serverCode <= ownCode) return; // up to date
            SharedPreferences prefs = prefs(ctx);
            prefs.edit()
                    .putInt(KEY_UPDATE_CODE, serverCode)
                    .putString(KEY_UPDATE_URL, j.optString("download_url", ""))
                    .putString(KEY_UPDATE_NAME, j.optString("version_name", ""))
                    .apply();
            if (prefs.getInt(KEY_LAST_UPDATE_NOTIFIED, 0) == serverCode) return;
            prefs.edit().putInt(KEY_LAST_UPDATE_NOTIFIED, serverCode).apply();
            postUpdateNotification(ctx,
                    j.optString("version_name", ""),
                    j.optString("download_url", ""),
                    j.optString("changelog", ""));
        } catch (Exception ignored) {
            // Server asleep, no network — try again next run.
        }
    }

    private static String readAll(java.io.InputStream in) throws Exception {
        java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(in, "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }

    // Schedule the 15-minute poll. Calling it again replaces the old job
    // (same JOB_ID), so it is safe to call on every app launch.
    public static void scheduleJob(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID,
                new ComponentName(ctx, NotificationJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(POLL_INTERVAL_MS)
                .setPersisted(true)
                .build();
        js.schedule(job);
    }

    // Show one notification row as a phone notification. Tapping it opens
    // the app on the notification's page (or /notifications by default).
    public static void postNotification(Context ctx, int id, String title, String message, String actionUrl) {
        String path = (actionUrl != null && actionUrl.startsWith("/")) ? actionUrl : "/notifications";
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.putExtra("open_path", path);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(ctx, CHANNEL_ID);
        } else {
            b = new Notification.Builder(ctx);
        }
        b.setSmallIcon(R.mipmap.ic_launcher)
         .setContentTitle(title)
         .setContentText(message)
         .setStyle(new Notification.BigTextStyle().bigText(message))
         .setAutoCancel(true)
         .setContentIntent(pi);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(id, b.build());
    }

    // App-update alert: tapping it opens the app and starts the download.
    public static void postUpdateNotification(Context ctx, String versionName, String downloadUrl, String changelog) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.putExtra("update_apk", true);
        intent.putExtra("update_url", downloadUrl);
        intent.putExtra("update_name", versionName);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, UPDATE_NOTIFICATION_ID, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String title = "New update available — Nexora FX " + versionName;
        String text = (changelog != null && !changelog.isEmpty())
                ? changelog : "Tap to update your app to the latest version.";
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(ctx, CHANNEL_ID);
        } else {
            b = new Notification.Builder(ctx);
        }
        b.setSmallIcon(R.mipmap.ic_launcher)
         .setContentTitle(title)
         .setContentText(text)
         .setStyle(new Notification.BigTextStyle().bigText(text))
         .setAutoCancel(true)
         .setContentIntent(pi);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(UPDATE_NOTIFICATION_ID, b.build());
    }
}
