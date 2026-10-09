# Testing

This document describes the checks implemented by the repository's current GitHub Actions workflows. A green workflow is evidence for the listed automated checks on that workflow's commit; it is not a claim that every device, feature, or failure mode has been tested.

## Web CI

Workflow: [Web CI](../.github/workflows/web.yml)

The workflow runs on pushes to `main`, pull requests, and manual dispatch. It uses Node.js 22 and runs from `web/`.

1. **Install** — `npm install --no-audit --no-fund`.
2. **Build** — `npm run build`, implemented by `web/scripts/build.mjs`.
3. **Web tests** — `npm test`, which runs Node's built-in test runner (`node --test`) against the Web test suite.
4. **Build artifact verification** — confirms that `dist/index.html` exists.
5. **Real-browser E2E** — runs `web/scripts/browser-e2e.mjs` against the built `dist/` output using a real Chromium/Chrome executable and Chrome DevTools Protocol (CDP).

The browser runner serves the built output locally, launches headless Chromium, waits for its DevTools endpoint, and drives browser interactions. It exercises real browser flows including editor interaction, layer operations, image import, PNG export, persistence/reload and Service Worker/cache readiness. The exact assertions are defined by the runner; the suite does not claim exhaustive coverage of every command or every browser.

### Local Web commands

From the repository root:

```sh
cd web
npm install --no-audit --no-fund
npm run build
npm test
```

To run the browser E2E after a successful build, ensure Chromium/Chrome is installed and available as `chromium`, `google-chrome`, or `google-chrome-stable`, then run from `web/`:

```sh
CHROME_BIN="$(command -v chromium || command -v google-chrome || command -v google-chrome-stable)" node scripts/browser-e2e.mjs
```

The browser test requires a graphical-browser executable even though it runs headless. It is not a pure unit test and can fail if Chromium is unavailable or cannot start.

## Android CI

Workflow: [Android CI](../.github/workflows/android.yml)

The workflow runs on pushes to `main`, pull requests, and manual dispatch. It configures JDK 17 and Gradle 8.11.1 and runs:

1. **Build / APK generation** — `gradle assembleDebug`.
2. **Unit tests** — `gradle test`.
3. **Lint** — `gradle lintDebug`.
4. **Instrumentation tests** — `gradle connectedDebugAndroidTest` on an Android API 30 x86_64 emulator.
5. **Startup smoke** — `bash scripts/android-startup-smoke.sh`, after instrumentation, on the configured emulator.
6. **APK artifact upload** — uploads `app/build/outputs/apk/debug/app-debug.apk`; the workflow fails if that file is missing.

The startup smoke installs the debug APK, starts `MainActivity`, checks that the process/activity and WebView renderer remain alive, and validates the Service Worker cache before running the configured offline-recovery checks. The workflow also includes the Android instrumentation test for WebView recreation/navigation-state restoration. These checks run on the configured emulator profile; they do not establish compatibility with every Android version, OEM device, screen size, or hardware configuration.

### Local Android commands

Run from the repository root with JDK 17, Gradle 8.11.1 (or a compatible installed Gradle), and Android SDK components configured:

```sh
gradle assembleDebug
gradle test
gradle lintDebug
gradle connectedDebugAndroidTest
bash scripts/android-startup-smoke.sh
```

The instrumentation and startup-smoke commands require a booted, reachable emulator/device with `adb`; the smoke script also requires the generated debug APK at the path above. CI provides the configured emulator and executes the commands in the required order.

## Offline and Service Worker coverage

- **Web browser E2E:** verifies Service Worker/cache readiness as part of the browser flow. It does not claim a full network-disconnect simulation in Chromium.
- **Android startup/offline smoke:** checks the expected Service Worker cache contents and exercises an offline-validation path on the emulator, including network blocking/cache-only behavior and reload recovery.
- **Scope:** this is automated evidence for the implemented app-shell/cache path, not a guarantee that every asset, future release, or arbitrary offline user journey will work.

## Interpreting results

- **Web CI SUCCESS** means the configured Web install, build, Node tests, build-output check and real-browser E2E steps completed successfully for that run.
- **Android CI SUCCESS** means the configured Android build, unit tests, lint, instrumentation/startup-smoke and APK upload steps completed successfully for that run.
- A result belongs only to the commit actually checked out by that run. PR runs and push/post-merge runs are separate evidence and must not be conflated.
- A green workflow does not imply exhaustive feature coverage, all-device compatibility, performance certification, or absence of all defects.

For a release or task closure, record the exact commit SHA, workflow run URL/ID, terminal conclusion, and relevant job-step results. Do not infer a run's commit from a nearby PR or from the current branch head.
