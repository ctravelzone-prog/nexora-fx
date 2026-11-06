# Nexora FX — Android App

A native Android wrapper for the Nexora FX website. The app opens the live
site in a WebView — login, trading, admin, everything works exactly as on
the web. There is no separate app code for trading features.

- **Package:** `com.nexorafx.app` — **App name:** Nexora FX — **Version:** 1.0 (versionCode 1)
- **Site address:** `https://nexora-fx-uxvy.onrender.com` (see `MainActivity.java`, `SITE_URL`)

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
