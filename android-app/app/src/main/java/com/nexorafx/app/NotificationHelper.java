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
