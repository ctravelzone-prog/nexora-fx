package com.nexorafx.app;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

// Polls the site's notifications and shows new ones on the phone.
// Runs every 15 minutes (JobScheduler minimum) — so a notification can
// arrive up to ~15 minutes after the event, not instantly. That is the
// trade-off of polling without Firebase; see android-app/README.md.
public class NotificationJobService extends JobService {

    private Thread worker;

    @Override
    public boolean onStartJob(final JobParameters params) {
        worker = new Thread(() -> {
            try {
                runCheck();
            } catch (Exception ignored) {
                // Network down, server asleep, bad JSON — try again next run.
            } finally {
                jobFinished(params, false);
            }
        });
        worker.start();
        return true; // work continues on the background thread
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        if (worker != null) worker.interrupt();
        return false; // do not reschedule — the periodic job runs again anyway
    }

    private void runCheck() throws Exception {
        // Update check runs even when the user is not logged in.
        checkForUpdate();
        SharedPreferences prefs = NotificationHelper.prefs(this);
        String token = prefs.getString(NotificationHelper.KEY_TOKEN, null);
        if (token == null || token.isEmpty()) return; // not logged in yet
        long lastSeen = prefs.getLong(NotificationHelper.KEY_LAST_SEEN_ID, 0);

        HttpURLConnection c = (HttpURLConnection) new URL(
                NotificationHelper.BASE_URL + "/api/user/notifications").openConnection();
        c.setRequestMethod("GET");
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Accept", "application/json");
        c.setConnectTimeout(10000);
        c.setReadTimeout(10000);
        int code = c.getResponseCode();
        if (code == 401) {
            // Token expired (user tokens last 7 days) — clear it; the next
            // app open syncs a fresh one from the WebView.
            prefs.edit().remove(NotificationHelper.KEY_TOKEN).apply();
            return;
        }
        if (code != 200) return;
        String body = readAll(c.getInputStream());
        c.disconnect();

        JSONArray arr = new JSONObject(body).optJSONArray("notifications");
        if (arr == null) return;
        // Rows come newest-first; collect the new ones (id > lastSeen).
        List<JSONObject> fresh = new ArrayList<>();
        long maxId = lastSeen;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject n = arr.optJSONObject(i);
            if (n == null) continue;
            long id = n.optLong("id", 0);
            if (id > maxId) maxId = id;
            if (id > lastSeen) fresh.add(n);
        }
        if (fresh.isEmpty()) {
            if (maxId > lastSeen) prefs.edit().putLong(NotificationHelper.KEY_LAST_SEEN_ID, maxId).apply();
            return;
        }
        // Oldest first, newest 5 at most (avoid a flood after a long absence).
        int start = Math.max(0, fresh.size() - 5);
        for (int i = fresh.size() - 1; i >= start; i--) {
            JSONObject n = fresh.get(i);
            NotificationHelper.postNotification(this,
                    (int) n.optLong("id", 0),
                    n.optString("title", "Nexora FX"),
                    n.optString("message", ""),
                    n.optString("action_url", null));
        }
        prefs.edit().putLong(NotificationHelper.KEY_LAST_SEEN_ID, maxId).apply();
    }

    // Asks the server which app version is current. If a newer one
    // exists, remembers it (so the app shows the update dialog on
    // launch) and notifies once per version.
    private void checkForUpdate() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(
                    NotificationHelper.BASE_URL + "/api/app/version").openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Accept", "application/json");
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            if (c.getResponseCode() != 200) return;
            String body = readAll(c.getInputStream());
            c.disconnect();
            JSONObject j = new JSONObject(body);
            int serverCode = j.optInt("version_code", 0);
            if (serverCode <= 0) return;
            int ownCode = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            if (serverCode <= ownCode) return; // up to date
            SharedPreferences prefs = NotificationHelper.prefs(this);
            prefs.edit()
                    .putInt(NotificationHelper.KEY_UPDATE_CODE, serverCode)
                    .putString(NotificationHelper.KEY_UPDATE_URL, j.optString("download_url", ""))
                    .putString(NotificationHelper.KEY_UPDATE_NAME, j.optString("version_name", ""))
                    .apply();
            if (prefs.getInt(NotificationHelper.KEY_LAST_UPDATE_NOTIFIED, 0) == serverCode) return;
            prefs.edit().putInt(NotificationHelper.KEY_LAST_UPDATE_NOTIFIED, serverCode).apply();
            NotificationHelper.postUpdateNotification(this,
                    j.optString("version_name", ""),
                    j.optString("download_url", ""),
                    j.optString("changelog", ""));
        } catch (Exception ignored) {
            // Server asleep, no network — try again next run.
        }
    }

    private static String readAll(InputStream in) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }
}
