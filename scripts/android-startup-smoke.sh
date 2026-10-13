#!/usr/bin/env bash
set -euo pipefail

adb wait-for-device
booted="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
if [ "$booted" != "1" ]; then
  echo "Android emulator did not finish booting."
  adb devices -l || true
  adb logcat -d -t 500 || true
  exit 1
fi

apk="app/build/outputs/apk/debug/app-debug.apk"
test -f "$apk"
adb install -r "$apk"
adb shell input keyevent 82 || true
adb logcat -c || true
adb shell am force-stop com.jonhararagi.animeart

set +e
start_output="$(timeout 60s adb shell am start -W -n com.jonhararagi.animeart/.MainActivity 2>&1)"
start_status=$?
set -e
printf '%s\n' "$start_output"
sleep 5

pid="$(timeout 10s adb shell pidof com.jonhararagi.animeart 2>/dev/null | tr -d '\r')"
top_activity="$(adb shell dumpsys activity activities 2>/dev/null | grep -m1 'mResumedActivity.*com.jonhararagi.animeart/.MainActivity' | tr -d '\r')"
if [ "$start_status" -ne 0 ] || ! printf '%s' "$start_output" | grep -q 'Status: ok'; then
  echo "Native Activity failed to start."
  adb logcat -d -t 800 || true
  exit 1
fi
if ! printf '%s' "$pid" | grep -q '[0-9]' || [ -z "$top_activity" ]; then
  echo "Native editor process or resumed Activity missing."
  adb logcat -d -t 800 || true
  exit 1
fi
if adb logcat -d -t 800 | grep -q 'FATAL EXCEPTION'; then
  echo "Native editor crashed during startup."
  adb logcat -d -t 800 || true
  exit 1
fi

wait_for_ui_marker() {
  local marker="$1"
  for _ in $(seq 1 20); do
    adb shell uiautomator dump /sdcard/animeart-window.xml >/dev/null 2>&1 || true
    local xml
    xml="$(adb shell cat /sdcard/animeart-window.xml 2>/dev/null | tr -d '\r')"
    if printf '%s' "$xml" | grep -Fq "$marker"; then return 0; fi
    sleep 1
  done
  return 1
}

for marker in "AnimeArt" "+ Imagen" "Pincel" "Borrador"; do
  if ! wait_for_ui_marker "$marker"; then
    echo "Native editor UI marker missing: $marker"
    adb logcat -d -t 800 || true
    exit 1
  fi
done

if adb logcat -d -t 800 | grep -q 'FATAL EXCEPTION'; then
  echo "Native editor crashed after UI became visible."
  adb logcat -d -t 800 || true
  exit 1
fi

echo "ANIMEART_NATIVE_STARTUP PASS process=$pid activity=$top_activity ui=Compose editor=visible network=not-required"
adb shell am force-stop com.jonhararagi.animeart
