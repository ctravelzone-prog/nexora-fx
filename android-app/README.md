# Nexora FX — Android App

A native Android wrapper for the Nexora FX website. The app opens the live
site in a WebView — login, trading, admin, everything works exactly as on
the web. There is no separate app code for trading features.

- **Package:** `com.nexorafx.app` — **App name:** Nexora FX — **Version:** 1.5 (versionCode 8)

**v1.5 (7 Nov) — instant notifications (live connection, no Firebase).**
A foreground service (`LivePushService`) holds a persistent secure
WebSocket to the site (`wss://nexorafx.us/ws/live`, server side is the
`ws` package on `/ws/live` — see `backend/src/services/livePush.js`)
and shows each notification the moment it is sent (target 1–3 s,
verified 0.3 s locally). The app authenticates with its user JWT as
the first WS message (never in the URL); the server pushes new
`notifications` rows to that user's live sockets (2 s poller, no
replay of old rows, bad token closes the socket). The WS client is
hand-written (framework APIs only — Android has no built-in WS client),
with ping/pong keep-alive and reconnect backoff (2 s → 60 s). Each
push goes through `NotificationHelper.noteLiveNotification`, which also
advances `last_seen_id`, so the 15-minute poller never posts the same
row twice. The 15-min job and the on-open check stay as fallbacks.
Android requires a quiet persistent notification while the service
runs ("Nexora FX live", IMPORTANCE_LOW); battery optimisation can
still pause it. A dead token stops the service (MainActivity restarts
it on the next login); logging out clears the saved token so the
previous user's notifications stop. v1.5 is signed with the same
keystore, so it installs as an update over v1.4.2.
- **Site address:** `https://nexorafx.us` (see `MainActivity.java`, `SITE_URL`)

**v1.3 (6 Nov) — phone notifications + in-app updates, no Firebase.**
A background job (`NotificationJobService`, every 15 min — the JobScheduler
minimum) polls `GET /api/user/notifications` with the user's login token
(synced from the WebView's localStorage on every page load) and shows each
new row as a phone notification; tapping one opens the app on that
notification's page. It covers deposit approve/reject, withdrawal,
KYC, support replies, admin messages — and daily profit (the backend
now writes a notification row per user per applied profit day in
`applyDailyPnl`). Notifications arrive up to ~15 min after the event,
not instantly — that is the trade-off of polling without Firebase.
Android 13+ asks for the notification permission on first launch; if
denied, alerts stay inside the app (bell). The same job also checks
`GET /api/app/version` (public; values from site_settings with code
defaults = current release): when a newer version exists it notifies
once and shows an in-app Update dialog on launch. Tapping Update
downloads the APK with DownloadManager and opens the installer
(`DownloadCompleteReceiver`); Android 8+ needs "Install unknown apps"
allowed for Nexora FX first (the app opens that setting). If the phone's
battery optimization kills the background job, notifications stop until
the app is opened again. v1.3 is signed with the same keystore, so it
installs as an update over v1.2. (v1.5 supersedes the 15-minute wait:
the live WebSocket pushes notifications instantly; the poll stays as
a fallback.)

**v1.2 fix (6 Nov):** the Copy Trade page rendered cut off on the right in
the app (cards too wide, Copy Now button unreachable, modal shifted, bottom
nav missing) — while the same page fits every phone width (320–390px, up to
1.5x text) in a standard browser. Cause: `setLoadWithOverviewMode(true)`
let the WebView pick a layout viewport wider than the phone screen. v1.2
removes that call and adds `setSupportZoom(false)`, so the WebView strictly
uses the viewport meta (`width=device-width`). `useWideViewPort` stays on.
Admin tables already scroll inside `overflow-x-auto` containers, so nothing
is lost. Site-side hardening shipped with it (site v65): `html` overflow-x
guard, `img`/`iframe` max-width, trader grids `grid-cols-1`, card bottom
row wraps. v1.2 is signed with the same keystore as v1.0/v1.1, so it
installs as an update. The site's Download button still points at the v1.1
release until the VPS move (the button is site code, and the site can't be
pushed while live data is on Render) — install v1.2 from the release link.

**v1.1 fix (6 Nov):** v1.0 had NO `targetSdkVersion` in the manifest, so the
APK defaulted to target 1 and Google Play Protect blocked the install as
"Unsafe app blocked / built for an older version of Android" — AND the same
missing targetSdk put the app in Android's old-compatibility mode, so it
rendered in a small top-left box with the rest of the screen black
(Siam-er 11:49 AM screenshot). v1.1 sets
`<uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />`
in `AndroidManifest.xml` (Android 14). **Never ship an APK without
targetSdkVersion — always verify with
`aapt2 dump badging NexoraFX.apk | grep targetSdkVersion` before release.**
v1.1 is signed with the same keystore as v1.0, so it installs as an update.

## What the app does

- Opens the live site full-screen (JavaScript + DOM storage on, so login works).
- Android back button goes back inside the site first, exits only at the home page.
- Links to the site stay in the app; links to other sites (Telegram, YouTube,
  Facebook) open in the phone's browser.
- File uploads on the site (profile photo, KYC) open the phone's file picker.
- Loading screen while the site opens (the free server can take ~50 s to wake).
- Error screen with a Retry button when the site cannot be reached.

## Build it (first time)

Needs JDK 17 + Android SDK (command-line tools are enough, no Android Studio).

### Option A — Gradle (normal internet)

```bash
# 1. Install the SDK packages (once):
export ANDROID_HOME=$HOME/Android
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
  "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# 2. Download Gradle 8.5 (once) and put it on PATH:
#    https://services.gradle.org/distributions/gradle-8.5-bin.zip

# 3. Create the signing keystore (once — see "Signing" below) and
#    android-app/keystore.properties (NOT committed — see below).

# 4. Build:
cd android-app
gradle assembleRelease
#    APK: app/build/outputs/apk/release/app-release.apk
```

### Option B — Manual build (no Gradle downloads)

Use this when Gradle cannot download its plugins (e.g. a network where
Java's HTTP client cannot use the proxy — `sdkmanager` and Gradle both
fail there, while `curl` works). Everything is built with the SDK tools
directly; the script does all 8 steps (aapt2 compile/link, javac, d8,
zip, zipalign, apksigner sign + verify).

```bash
export JAVA_HOME=$HOME/jdk17 ANDROID_HOME=$HOME/Android
cd android-app
./build-apk.sh
#    APK: build-manual/NexoraFX.apk (also copied to android-app/NexoraFX.apk)
```

If `sdkmanager` fails on your machine, download the SDK packages with
`curl` instead and unzip them by hand:
- `platform-tools-latest-linux.zip` -> `$ANDROID_HOME/`
- `build-tools_r34-linux.zip` -> `$ANDROID_HOME/build-tools/34.0.0/`
  (the zip has a top `android-14/` folder — move its contents up one level)
- `platform-34-ext12_r01.zip` -> `$ANDROID_HOME/platforms/android-34/`
  (same: move the contents of the `android-34-ext12/` folder up one level)

Debug build (no keystore needed, for testing only):

```bash
gradle assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## Signing — read this

The release APK is signed with a keystore (`nexora-release.keystore`).
**Keep that file and its passwords safe and never lose them.** Android
refuses to update the app if a new version is signed with a different key —
users would have to uninstall and reinstall. The keystore is NOT in git
and NOT in the zip on purpose; back it up separately.

Create it once (JDK's `keytool`):

```bash
keytool -genkeypair -keystore ~/nexora-release.keystore \
  -alias nexora -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android-app/keystore.properties` (NOT committed — it holds
passwords, and it is in `.gitignore`):

```
storeFile=/home/<you>/nexora-release.keystore
storePassword=<the password you chose>
keyAlias=nexora
keyPassword=<the same password>
```

Note: the keystore is PKCS12, so the key password MUST be the same as
the store password — a different key password is silently ignored and
signing fails with "Wrong password?". Use one password for both.

## Releasing a new version

1. In `app/build.gradle`, bump `versionCode` (must always go up by 1 or more)
   and `versionName` (e.g. `1.1`).
2. If the site moved to a new address (e.g. the VPS domain), change `SITE_URL`
   in `app/src/main/java/com/nexorafx/app/MainActivity.java` (and `SITE_HOST`
   to the new host, so in-app links still work).
3. Rebuild (`gradle assembleRelease`) and upload the APK to a GitHub Release:
   `gh release create v1.1-android app/build/outputs/apk/release/app-release.apk`
4. Point the site's home-page "Download Android App" button at the new
   release download URL (see `frontend/js/pages/landing.js`).
5. Bump the site's `?v=` cache version (index.html + admin.html) when the
   button link changes, so users get the new button.

## Files

```
android-app/
├── README.md                  This file
├── settings.gradle            Project settings (module list)
├── build.gradle               Root build file (AGP version)
├── gradle.properties          Gradle settings (AndroidX on)
├── keystore.properties        Signing passwords — NOT in git, create it yourself
├── app/
│   ├── build.gradle           App module (package, SDK versions, signing)
│   ├── proguard-rules.pro     ProGuard rules (minify is off)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/nexorafx/app/MainActivity.java   The whole app
│       └── res/
│           ├── layout/activity_main.xml   WebView + loading + error screens
│           ├── values/strings.xml  values/colors.xml  values/themes.xml
│           └── mipmap-*/ic_launcher.png   App icon (NX mark, all densities)
```
