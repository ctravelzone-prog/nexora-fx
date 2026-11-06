package com.nexorafx.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;

// Fires when the update APK finishes downloading: opens the installer
// so the user can tap Install and get the new version.
public class DownloadCompleteReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
        long want = NotificationHelper.prefs(context).getLong(NotificationHelper.KEY_DOWNLOAD_ID, -1);
        if (id == -1 || id != want) return;
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;
        Cursor cur = null;
        try {
            cur = dm.query(new DownloadManager.Query().setFilterById(id));
            if (cur == null || !cur.moveToFirst()) return;
            int status = cur.getInt(cur.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status != DownloadManager.STATUS_SUCCESSFUL) return;
        } finally {
            if (cur != null) cur.close();
        }
        Uri uri = dm.getUriForDownloadedFile(id);
        if (uri == null) return;
        NotificationHelper.prefs(context).edit().remove(NotificationHelper.KEY_DOWNLOAD_ID).apply();
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.startActivity(install);
    }
}
