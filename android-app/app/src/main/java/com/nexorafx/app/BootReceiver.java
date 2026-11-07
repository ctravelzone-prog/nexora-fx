package com.nexorafx.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// After a phone restart, re-schedule the 15-minute notification poll.
// (The job is also persisted, so this is belt-and-braces.)
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            NotificationHelper.scheduleJob(context);
            // v1.5: resume the live connection after a phone restart.
            LivePushService.start(context);
        }
    }
}
