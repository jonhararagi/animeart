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
top_activity="$(adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' | grep -m1 'com.jonhararagi.animeart/.MainActivity' | tr -d '\r')"
set -e

if [ "$pid_status" -ne 0 ] || ! printf '%s' "$pid" | grep -q '[0-9]'; then
  echo "MainActivity no dejó un proceso vivo (pidof exit=$pid_status, pid='$pid'). Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

if [ "$start_status" -ne 0 ]; then
  echo "am start -W terminó con exit=$start_status aunque el proceso sigue vivo. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

if ! printf '%s' "$start_output" | grep -q 'Status: ok'; then
  echo "am start -W no confirmó Status: ok. Proceso=$pid. Activity resumida='$top_activity'. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

if [ -z "$top_activity" ]; then
  echo "El proceso sigue vivo pero MainActivity no figura como actividad resumida. Proceso=$pid. Logcat:"
  adb logcat -d -t 500 || true
  exit 1
fi

echo "Startup confirmado: pid=$pid; MainActivity resumida=$top_activity"

# End the standalone startup probe before instrumentation so the WebView test starts
# with exactly one fresh MainActivity/WebView and no cross-test page state.
adb shell am force-stop com.jonhararagi.animeart

# T047 container smoke: reuse this startup script and install the instrumentation APK needed by the WebView assertions.
# The workflow already provisions Gradle, so no second smoke system is introduced.
android_test_apk="app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
if [ ! -f "$android_test_apk" ]; then
  gradle assembleDebugAndroidTest
fi
adb install -r "$android_test_apk"

# T047 container smoke: query the real WebView DOM and verify the existing Web editor is alive.
# The instrumentation test contains multiple bounded readiness waits, so this wrapper
# must cover the complete test budget rather than terminate it prematurely.
set +e
webview_probe="$(timeout 120s adb shell 'am instrument -w -e class com.jonhararagi.animeart.WebViewContainerSmokeTest com.jonhararagi.animeart.test/androidx.test.runner.AndroidJUnitRunner' 2>&1)"
probe_status=$?
set -e
printf '%s\n' "$webview_probe"
if [ "$probe_status" -ne 0 ] || printf '%s' "$webview_probe" | grep -q 'FAILURES!!!' || ! printf '%s' "$webview_probe" | grep -q 'OK (1 test)'; then
  echo "WebView container smoke failed (exit=$probe_status). Instrumentation output:"
  printf '%s\n' "$webview_probe"
  echo "Logcat:"
  adb logcat -d -t 800 || true
  exit 1
fi

echo "WebView container smoke confirmed: 1 instrumentation test passed."
adb shell am force-stop com.jonhararagi.animeart
