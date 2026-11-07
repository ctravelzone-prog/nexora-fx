#!/bin/bash
# Nexora FX Android app — manual APK build (no Gradle downloads needed).
#
# Why this script exists: Gradle cannot download its plugins on machines
# whose network goes through a proxy that Java's HTTP client cannot use
# (Java's HttpURLConnection fails the proxy CONNECT step). This script
# builds the same APK with the Android SDK tools directly — everything
# it needs is already on disk (aapt2, d8, zipalign, apksigner).
#
# Usage:
#   export JAVA_HOME=$HOME/jdk17 ANDROID_HOME=$HOME/Android
#   ./build-apk.sh
# Output: app/build-manual/NexoraFX.apk (signed release APK)
#
# Before the first run you need:
#   - Android SDK: platforms;android-34 + build-tools;34.0.0
#     (see android-app/README.md — if sdkmanager fails, download the
#     zips with curl and unzip them into $ANDROID_HOME by hand)
#   - A release keystore + keystore.properties (see README.md "Signing").
#     Keep the keystore OUT of git — only this script reads it.
#
# To release a new version: bump android:versionCode / android:versionName
# in app/src/main/AndroidManifest.xml (and versionCode/versionName in
# app/build.gradle, so the Gradle build stays in sync), then run this.
set -e
cd "$(dirname "$0")"

: "${JAVA_HOME:?set JAVA_HOME to your JDK 17 folder}"
: "${ANDROID_HOME:?set ANDROID_HOME to your Android SDK folder}"
export PATH="$JAVA_HOME/bin:$PATH"

APP_DIR="$(pwd)"
BUILD="$APP_DIR/build-manual"
BT="$ANDROID_HOME/build-tools/34.0.0"
PLATFORM="$ANDROID_HOME/platforms/android-34/android.jar"
KS_FILE="$APP_DIR/keystore.properties"

if [ ! -f "$KS_FILE" ]; then
    echo "ERROR: keystore.properties not found in $APP_DIR"
    echo "Copy it from your safe backup (it is never committed to git)."
    exit 1
fi
STORE_FILE=$(grep '^storeFile=' "$KS_FILE" | cut -d= -f2-)
STORE_PASS=$(grep '^storePassword=' "$KS_FILE" | cut -d= -f2-)
KEY_PASS=$(grep '^keyPassword=' "$KS_FILE" | cut -d= -f2-)

rm -rf "$BUILD"
mkdir -p "$BUILD/compiled-res" "$BUILD/classes" "$BUILD/dex"

echo "== 1. aapt2 compile (resources) =="
"$BT/aapt2" compile --dir "$APP_DIR/app/src/main/res" -o "$BUILD/compiled-res.zip"

echo "== 2. aapt2 link (manifest + resources -> unsigned APK, R.java) =="
"$BT/aapt2" link -o "$BUILD/app-unsigned.apk" -I "$PLATFORM" \
    --manifest "$APP_DIR/app/src/main/AndroidManifest.xml" \
    "$BUILD/compiled-res.zip" --java "$BUILD/classes" --auto-add-overlay

echo "== 3. javac (MainActivity + R.java) =="
"$JAVA_HOME/bin/javac" -encoding UTF-8 -d "$BUILD/classes" \
    -cp "$PLATFORM" -sourcepath "$BUILD/classes" \
    "$APP_DIR/app/src/main/java/com/nexorafx/app/MainActivity.java" \
    "$APP_DIR/app/src/main/java/com/nexorafx/app/NotificationHelper.java" \
    "$APP_DIR/app/src/main/java/com/nexorafx/app/NotificationJobService.java" \
    "$APP_DIR/app/src/main/java/com/nexorafx/app/LivePushService.java" \
    "$APP_DIR/app/src/main/java/com/nexorafx/app/BootReceiver.java" \
    "$BUILD/classes/com/nexorafx/app/R.java"

echo "== 4. d8 (classes -> classes.dex) =="
"$BT/d8" --release --output "$BUILD/dex" --lib "$PLATFORM" \
    "$BUILD/classes/com/nexorafx/app/"*.class

echo "== 5. add classes.dex to the APK =="
cp "$BUILD/dex/classes.dex" "$BUILD/classes.dex"
(cd "$BUILD" && zip -q app-unsigned.apk classes.dex)

echo "== 6. zipalign =="
"$BT/zipalign" -f -p 4 "$BUILD/app-unsigned.apk" "$BUILD/app-aligned.apk"

echo "== 7. sign (release keystore) =="
"$BT/apksigner" sign --ks "$STORE_FILE" --ks-pass "pass:$STORE_PASS" \
    --key-pass "pass:$KEY_PASS" --ks-key-alias nexora \
    --out "$BUILD/NexoraFX.apk" "$BUILD/app-aligned.apk"

echo "== 8. verify =="
"$BT/apksigner" verify --verbose "$BUILD/NexoraFX.apk" | head -4
"$BT/aapt2" dump badging "$BUILD/NexoraFX.apk" | head -3
ls -la "$BUILD/NexoraFX.apk"
echo "DONE: $BUILD/NexoraFX.apk"
