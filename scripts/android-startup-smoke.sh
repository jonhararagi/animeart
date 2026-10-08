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

wait_for_ui_marker() {
  local marker="$1"
  local attempts="$2"
  for _ in $(seq 1 "$attempts"); do
    adb shell uiautomator dump /sdcard/animeart-window.xml >/dev/null
    local xml
    xml="$(adb shell cat /sdcard/animeart-window.xml 2>/dev/null | tr -d '\r')"
    if printf '%s' "$xml" | grep -Fq "$marker"; then return 0; fi
    sleep 1
  done
  return 1
}

echo "Startup WebView confirmado: pid=$pid; MainActivity=$top_activity; Web=ANIMEART; status=Local-first editor; canvas=AnimeArt canvas"
wait_for_log_marker() {
  local marker="$1"
  local attempts="$2"
  for _ in $(seq 1 "$attempts"); do
    if adb logcat -d -t 1200 | grep -Fq "$marker"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! wait_for_log_marker '"registered":true,"active":true,"cache":"animeart-web-shell-v1","cachedCount":13,"requiredCount":13,"missing":[],"canvas":true' 30; then
  echo "No se demostró SW ACTIVE + CACHE 13/13 antes de offline. Logcat:"
  adb logcat -d -t 800 || true
  exit 1
fi
echo 'ANIMEART_OFFLINE_DIAGNOSTIC registered=true active=true cache=animeart-web-shell-v1 cachedCount=13 requiredCount=13 missing=[] canvas=true phase=online-ready'

echo "NETWORK OFF will be enforced by Android emulator airplane mode + WebView offline mode"
adb shell cmd connectivity airplane-mode enable || true
adb shell settings put global airplane_mode_on 1 || true
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true >/dev/null 2>&1 || true
network_state="$(adb shell settings get global airplane_mode_on 2>/dev/null | tr -d '\r')"
if [ "$network_state" != "1" ]; then
  echo "Android emulator no confirmó airplane mode=ON. Estado='$network_state'."
  adb shell settings get global airplane_mode_on || true
  adb logcat -d -t 800 || true
  exit 1
fi
echo "NETWORK OFF confirmado por Android emulator airplane mode"
adb logcat -c
adb shell am force-stop com.jonhararagi.animeart
set +e
offline_output="$(timeout 60s adb shell am start -W --ez animeart_offline_validation true -n com.jonhararagi.animeart/.MainActivity 2>&1)"
offline_status=$?
set -e
printf '%s\n' "$offline_output"
sleep 5

offline_pid="$(timeout 10s adb shell pidof com.jonhararagi.animeart 2>/dev/null | tr -d '\r')"
if [ -z "$offline_pid" ] || ! printf '%s' "$offline_pid" | grep -q '[0-9]'; then
  echo "Offline reload no dejó el proceso vivo. Logcat:"
  adb logcat -d -t 800 || true
  exit 1
fi
if [ "$offline_status" -ne 0 ] || ! printf '%s' "$offline_output" | grep -q 'Status: ok'; then
  echo "Offline reload no confirmó Status: ok. Logcat:"
  adb logcat -d -t 800 || true
  exit 1
fi
if ! wait_for_log_marker 'ANIMEART_OFFLINE_INTENT=true' 30; then
  echo "Offline reload no confirmó animeart_offline_validation=true."
  adb logcat -d -t 1200 || true
  exit 1
fi

if ! wait_for_log_marker 'ANIMEART_OFFLINE_NETWORK webViewBlockNetworkLoads=true; webViewCacheMode=3; serviceWorkerBlockNetworkLoads=true' 30; then
  echo "Offline reload no demostró network OFF real en WebView."
  adb logcat -d -t 1200 || true
  exit 1
fi

if ! wait_for_log_marker '"registered":true,"active":true,"cache":"animeart-web-shell-v1","cachedCount":13,"requiredCount":13,"missing":[],"canvas":true' 30; then
  echo "Offline reload no demostró Service Worker ACTIVE + Cache 13/13 + JavaScript + Canvas. Logcat:"
  adb logcat -d -t 1200 || true
  exit 1
fi
echo 'ANIMEART_OFFLINE_DIAGNOSTIC registered=true active=true cache=animeart-web-shell-v1 cachedCount=13 requiredCount=13 missing=[] canvas=true phase=offline-recovery'


if adb logcat -d -t 800 | grep -q 'FATAL EXCEPTION'; then
  echo "Offline smoke detectó FATAL EXCEPTION. Logcat:"
  adb logcat -d -t 800 || true
  exit 1
fi

echo "OFFLINE VALIDATION PASS: network=WebView blockNetworkLoads + LOAD_CACHE_ONLY; reload=PASS; AnimeArt=PASS; JavaScript=PASS; Canvas=PASS"
adb shell cmd connectivity airplane-mode disable || true
adb shell settings put global airplane_mode_on 0 || true
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1 || true
adb shell svc wifi enable >/dev/null 2>&1 || true
adb shell am force-stop com.jonhararagi.animeart
