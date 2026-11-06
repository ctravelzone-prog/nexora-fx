package com.nexorafx.app;

import android.app.job.JobParameters;
import android.app.job.JobService;



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
                // v1.4.2: the check lives in NotificationHelper now, so the
                // app can run the same check immediately on open/resume.
                NotificationHelper.runCheck(this);
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


}
