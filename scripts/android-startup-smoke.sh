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

adb shell cmd connectivity airplane-mode enable
network_state="$(adb shell cmd connectivity airplane-mode 2>/dev/null | tr -d '\r' | tail -n 1)"
if ! printf '%s' "$network_state" | grep -qi 'enabled'; then
  echo "No se pudo verificar network OFF mediante connectivity airplane-mode. Estado='$network_state'."
  adb logcat -d -t 800 || true
  exit 1
fi
echo "NETWORK OFF confirmado: $network_state"

adb logcat -c
adb shell am force-stop com.jonhararagi.animeart
set +e
offline_output="$(timeout 60s adb shell am start -W -n com.jonhararagi.animeart/.MainActivity --ez animeart_offline_validation true 2>&1)"
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
if ! wait_for_log_marker '"registered":true,"active":true,"cache":"animeart-web-shell-v1","cachedCount":13,"requiredCount":13,"missing":[],"canvas":true' 30; then
  echo "Offline reload no demostró Service Worker ACTIVE + Cache 13/13 + JavaScript + Canvas. Logcat:"
  adb logcat -d -t 1200 || true
  exit 1
fi

for marker in "ANIMEART" "AnimeArt canvas"; do
  if ! wait_for_ui_marker "$marker" 20; then
    echo "Offline reload no encontró el marcador '$marker'. Logcat:"
    adb logcat -d -t 800 || true
    exit 1
  fi
done
if adb logcat -d -t 800 | grep -q 'FATAL EXCEPTION'; then
  echo "Offline smoke detectó FATAL EXCEPTION. Logcat:"
  adb logcat -d -t 800 || true
  exit 1
fi

echo "OFFLINE VALIDATION PASS: network=$network_state; reload=PASS; AnimeArt=PASS; JavaScript=PASS; Canvas=PASS"
adb shell cmd connectivity airplane-mode disable || true
adb shell am force-stop com.jonhararagi.animeart
