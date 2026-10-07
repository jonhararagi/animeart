#!/usr/bin/env bash
set -euo pipefail

adb wait-for-device
booted="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
if [ "$booted" != "1" ]; then
  echo "El emulador no alcanzó sys.boot_completed=1. Diagnóstico:"
  adb devices -l || true
  adb logcat -d -t 500 || true
  exit 1
fi

test -f app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell input keyevent 82 || true
adb logcat -c || true
adb shell am force-stop com.jonhararagi.animeart

set +e
start_output="$(timeout 60s adb shell am start -W -n com.jonhararagi.animeart/.MainActivity 2>&1)"
start_status=$?
set -e
printf '%s\n' "$start_output"

sleep 5
set +e
pid="$(timeout 10s adb shell pidof com.jonhararagi.animeart 2>/dev/null | tr -d '\r')"
pid_status=$?
top_activity="$(adb shell dumpsys activity activities 2>/dev/null | grep -m1 'mResumedActivity.*com.jonhararagi.animeart/.MainActivity' | tr -d '\r')"
set -e

if [ "$pid_status" -ne 0 ] || ! printf '%s' "$pid" | grep -q '[0-9]'; then
  echo "MainActivity no dejó un proceso vivo (pidof exit=$pid_status, pid='$pid'). Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

if [ "$start_status" -ne 0 ] || ! printf '%s' "$start_output" | grep -q 'Status: ok'; then
  echo "am start -W no confirmó Status: ok. Proceso=$pid. Activity resumida='$top_activity'. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

if [ -z "$top_activity" ]; then
  echo "El proceso sigue vivo pero MainActivity no figura como actividad resumida. Proceso=$pid. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

adb shell uiautomator dump /sdcard/animeart-window.xml >/dev/null
ui_xml="$(adb shell cat /sdcard/animeart-window.xml 2>/dev/null | tr -d '\r')"
for marker in "ANIMEART" "Local-first editor" "AnimeArt canvas"; do
  if ! printf '%s' "$ui_xml" | grep -Fq "$marker"; then
    echo "Startup smoke no encontró el marcador Web '$marker' en la jerarquía UI. Proceso=$pid. Logcat:"
    adb logcat -d -t 500 || true
    exit 1
  fi
done

if ! adb logcat -d -t 500 | grep -q 'com.android.webview:sandboxed_process'; then
  echo "Startup smoke no observó el renderer de WebView en logcat. Proceso=$pid. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

if adb logcat -d -t 500 | grep -q 'FATAL EXCEPTION'; then
  echo "Startup smoke detectó FATAL EXCEPTION. Proceso=$pid. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

echo "Startup WebView confirmado: pid=$pid; MainActivity=$top_activity; Web=ANIMEART; status=Local-first editor; canvas=AnimeArt canvas"
adb shell am force-stop com.jonhararagi.animeart
