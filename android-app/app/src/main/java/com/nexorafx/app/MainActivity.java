package com.nexorafx.app;

import android.app.Activity;
import android.content.Intent;
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
    private static final String SITE_URL = "https://nexora-fx-uxvy.onrender.com";

    // Hosts that stay INSIDE the app. Any other link (Telegram, YouTube,
    // Facebook, etc.) opens in the phone's browser instead.
    private static final String SITE_HOST = "nexora-fx-uxvy.onrender.com";

    private static final int FILE_CHOOSER_REQUEST_CODE = 100;

    private WebView webView;
    private ProgressBar progressBar;
    private View loadingView;
    private View errorView;
    private TextView errorText;

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

        setupWebView();
        loadSite();
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
        webView.loadUrl(SITE_URL);
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
