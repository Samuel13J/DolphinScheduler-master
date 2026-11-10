#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO="$(CDPATH= cd -- "$ROOT/.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-/tmp/android-sdk}"
BT="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
OUT="$ROOT/build"
rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/assets/www" "$OUT/res/drawable"
cp "$ROOT/../petclock-daynight-v3/assets/icon.png" "$OUT/res/drawable/icon.png"
# 卡片页面打进 apk。调试宿主看到 AndroidClock 会改走车机媒体，网页卡片不受影响。
cp -a "$ROOT/../petclock-daynight-v3/." "$OUT/assets/www/"
rm -f "$OUT/assets/www/"*.zip
find "$OUT/assets/www" -name '*.html' ! -name 'index.html' -delete
javac --release 8 -encoding UTF-8 -classpath "$ANDROID_JAR" -d "$OUT/classes" \
  "$ROOT/src/app/petclock/lyrics/"*.java
"$BT/d8" --min-api 21 --lib "$ANDROID_JAR" --output "$OUT" "$OUT/classes/app/petclock/lyrics/"*.class
"$BT/aapt2" compile --dir "$OUT/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" \
  --manifest "$ROOT/AndroidManifest.xml" \
  --min-sdk-version 21 --target-sdk-version 28 \
  --auto-add-overlay \
  -A "$OUT/assets" \
  "$OUT/res.zip"
( cd "$OUT" && zip -q -j unsigned.apk classes.dex )
"$BT/zipalign" -p -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$ROOT/debug.keystore" ]; then
  keytool -genkeypair -keystore "$ROOT/debug.keystore" -storepass petclock -keypass petclock \
    -alias petclock -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Petclock, OU=Card, O=Petclock, L=Shanghai, ST=Shanghai, C=CN"
fi
"$BT/apksigner" sign --ks "$ROOT/debug.keystore" --ks-pass pass:petclock --key-pass pass:petclock \
  --ks-key-alias petclock --out "$REPO/lyrics-clock.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --min-sdk-version 21 "$REPO/lyrics-clock.apk"
cp -f "$REPO/lyrics-clock.apk" /opt/cursor/artifacts/lyrics-clock.apk
ls -l "$REPO/lyrics-clock.apk"
