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
timeout 60s adb shell am start -W -n com.jonhararagi.animeart/.MainActivity
start_status=$?
set -e

if [ "$start_status" -ne 0 ]; then
  echo "MainActivity no pudo iniciar dentro de 60 segundos (exit=$start_status). Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

sleep 5
set +e
pid="$(timeout 10s adb shell pidof com.jonhararagi.animeart 2>/dev/null | tr -d '\r')"
pid_status=$?
set -e
if [ "$pid_status" -ne 0 ] || ! printf '%s' "$pid" | grep -q '[0-9]'; then
  echo "MainActivity terminó inmediatamente después del arranque. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

adb shell am force-stop com.jonhararagi.animeart
