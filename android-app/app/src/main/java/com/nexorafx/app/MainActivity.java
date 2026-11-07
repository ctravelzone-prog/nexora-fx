package com.nexorafx.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;

// Nexora FX Android app — single-activity WebView wrapper.
//
// What it does: opens the live Nexora FX website inside the app.
// The site itself (login, trading, admin) runs exactly as on the web —
// this app is only a native shell around it. It uses Android framework
// APIs only (no AndroidX libraries), so it builds with the SDK tools
// alone — see android-app/README.md for both the Gradle and the manual
// (aapt2 + d8) build.
//
// To point the app at a new address (e.g. the VPS domain later),
// change SITE_URL below and rebuild. Nothing else needs to change.
public class MainActivity extends Activity {

    // Live site address. Change this when the site moves to its own
    // domain (VPS) and rebuild the APK — users get the new address
    // with the next app update.
    private static final String SITE_URL = "https://nexorafx.us";

    // Hosts that stay INSIDE the app. Any other link (Telegram, YouTube,
    // Facebook, etc.) opens in the phone's browser instead.
    private static final String SITE_HOST = "nexorafx.us";

    private static final int FILE_CHOOSER_REQUEST_CODE = 100;

    private WebView webView;
    private ProgressBar progressBar;
    private View loadingView;
    private View errorView;
    private TextView errorText;

    // Page to open when the app was launched from a notification tap
    // (e.g. "/notifications"), or null for the home page.
    private String openPath;

    // File picker result (for profile-photo / KYC uploads on the site).
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress_bar);
        loadingView = findViewById(R.id.loading_view);
        errorView = findViewById(R.id.error_view);
        errorText = findViewById(R.id.error_text);
        Button retryButton = findViewById(R.id.retry_button);
        retryButton.setOnClickListener(v -> loadSite());

        // v1.3: phone notifications (polling, no Firebase).
        NotificationHelper.createChannel(this);
        NotificationHelper.scheduleJob(this);
        // v1.5: instant notifications — start the live WebSocket service.
        LivePushService.start(this);
        // v1.4.2: check right away on open — waiting for the 15-min job
        // left fresh notifications (e.g. a deposit reject) unseen.
        NotificationHelper.checkNow(this);
        requestNotificationPermission();
        // Open on the notification's page when launched from a tap.
        openPath = getIntent() != null ? getIntent().getStringExtra("open_path") : null;

        setupWebView();
        loadSite();

        // v1.3: launched from the update notification — start the
        // download right away. Otherwise, if the poller found a newer
        // version, offer it with an in-app dialog.
        if (getIntent() != null && getIntent().getBooleanExtra("update_apk", false)) {
            String u = getIntent().getStringExtra("update_url");
            if (u != null && !u.isEmpty()) startApkUpdate(u);
        } else {
            maybeShowUpdateDialog();
        }
    }

    // v1.4.2: check again when the app comes back to the foreground.
    @Override
    protected void onResume() {
        super.onResume();
        NotificationHelper.checkNow(this);
    }

    // This app's own versionCode (from the manifest).
    private int ownVersionCode() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    // If the background poller found a newer version, offer it once per
    // version. "Later" silences the dialog for that version (the
    // notification already fired once); "Update" starts the download.
    private void maybeShowUpdateDialog() {
        SharedPreferences prefs = NotificationHelper.prefs(this);
        int code = prefs.getInt(NotificationHelper.KEY_UPDATE_CODE, 0);
        String url = prefs.getString(NotificationHelper.KEY_UPDATE_URL, null);
        String name = prefs.getString(NotificationHelper.KEY_UPDATE_NAME, "");
        if (code <= 0 || code <= ownVersionCode() || url == null || url.isEmpty()) return;
        if (prefs.getInt(NotificationHelper.KEY_UPDATE_DISMISSED, 0) == code) return;
        new AlertDialog.Builder(this)
                .setTitle("New version " + name + " available")
                .setMessage("A new version of Nexora FX is available. Update now to get the latest features and fixes.")
                .setPositiveButton("Update", (d, w) -> startApkUpdate(url))
                .setNegativeButton("Later", (d, w) ->
                        prefs.edit().putInt(NotificationHelper.KEY_UPDATE_DISMISSED, code).apply())
                .setCancelable(true)
                .show();
    }

    // v1.4.1: updates install from the browser, not from inside the app.
    // The app no longer declares REQUEST_INSTALL_PACKAGES — that permission
    // made Play Protect block fresh installs as a "harmful app" (before
    // v1.3 the app installed with a plain "Install anyway" prompt). Update
    // opens the download in the browser; the user taps the downloaded
    // file to install it with the system installer.
    private void startApkUpdate(String url) {
        if (url == null || url.isEmpty()) return;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(i);
            Toast.makeText(this, "Downloading update in browser — tap the file to install", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Could not open download", Toast.LENGTH_SHORT).show();
        }
    }

    // Android 13+ needs a runtime permission before any notification
    // can appear in the notification bar. If the user denies it, the
    // app still works — notifications just stay inside the app (bell).
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
    }

    // Notification tap while the app is already running: open the
    // notification's page instead of staying where the user was.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String p = intent.getStringExtra("open_path");
        if (p != null) {
            openPath = p;
            loadSite();
        }
        if (intent.getBooleanExtra("update_apk", false)) {
            String u = intent.getStringExtra("update_url");
            if (u != null && !u.isEmpty()) startApkUpdate(u);
        }
    }

    // WebView settings: JavaScript on (the site is a JS app), DOM storage
    // on (login token lives in localStorage), zoom off (site is responsive).
    // v1.2: loadWithOverviewMode REMOVED (was true) — it let the WebView
    // pick a layout viewport wider than the phone screen, so the Copy
    // Trade cards rendered cut off on the right and fixed elements
    // (modal, bottom nav) landed in the wrong place. With it off and
    // useWideViewPort on, the WebView strictly uses the viewport meta
    // (width=device-width). Support zoom is off too, so the page can
    // never get stuck zoomed in. The site itself fits every phone width
    // (verified 320-390px at up to 1.5x text in Chrome), so no zoom is
    // needed. Admin tables already scroll inside overflow-x-auto
    // containers, so nothing is lost by turning overview mode off.
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // Lets the site know the request comes from the app (optional,
        // the site does not depend on it today).
        settings.setUserAgentString(
                settings.getUserAgentString() + " NexoraFXApp/1.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // Same site -> stay in the app. Anything else -> browser.
                if (SITE_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loadingView.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
                progressBar.setVisibility(View.GONE);
                // v1.3: keep the login token available to the background
                // poller so it can fetch new notifications while the app
                // is closed. The token lives in localStorage; read it
                // after every page load (it refreshes on each login).
                webView.evaluateJavascript("localStorage.getItem('nx_token')", value -> {
                    SharedPreferences p = NotificationHelper.prefs(MainActivity.this);
                    if (value == null || value.length() < 4 || "null".equals(value)) {
                        // Logged out (or not logged in yet) — the live
                        // service and the poller must not keep using the
                        // previous user's token.
                        p.edit().remove(NotificationHelper.KEY_TOKEN).apply();
                        return;
                    }
                    String token = value.replaceAll("^\"|\"$", "");
                    if (token.isEmpty()) {
                        p.edit().remove(NotificationHelper.KEY_TOKEN).apply();
                        return;
                    }
                    boolean fresh = !token.equals(p.getString(NotificationHelper.KEY_TOKEN, null));
                    p.edit().putString(NotificationHelper.KEY_TOKEN, token).apply();
                    // v1.4.2: a fresh login means a new token — check right
                    // away (bypasses the 60s throttle) so notifications
                    // arrive at once instead of at the next 15-min tick.
                    // v1.5: also (re)start the live service with it.
                    if (fresh) {
                        NotificationHelper.checkNow(MainActivity.this, true);
                        LivePushService.start(MainActivity.this);
                    }
                });
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                // Only the main page failing counts (not a sub-resource).
                if (request.isForMainFrame()) {
                    loadingView.setVisibility(View.GONE);
                    progressBar.setVisibility(View.GONE);
                    errorText.setText(getString(R.string.error_load_failed));
                    errorView.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(
                        newProgress < 100 ? View.VISIBLE : View.GONE);
            }

            // File chooser: the site's upload inputs (profile photo, KYC)
            // need this, otherwise tapping "upload" does nothing.
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    // File picker result: hands the chosen file back to the WebView.
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST_CODE || filePathCallback == null) {
            return;
        }
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null) {
                results = new Uri[]{uri};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    private void loadSite() {
        errorView.setVisibility(View.GONE);
        loadingView.setVisibility(View.VISIBLE);
        webView.loadUrl(SITE_URL + (openPath != null ? openPath : ""));
    }

    // Back button: go back inside the site first; exit only when there
    // is no page to go back to.
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
