# APK signing compatibility audit

**Date:** 2026-10-18  
**TIMER:** 1–2 hours estimated for artifact inspection, workflow hardening, and documentation; active time not measured.

## Evidence before change

- Starting `main`: `c9d8d7ad33cb1c93499aafe480aaaf044604af65`.
- Android CI [#39164850908](https://github.com/jonhararagi/animeart/actions/runs/39164850908) passed compilation, APK-content checks, unit tests, lint, emulator instrumentation, offline startup, and artifact upload.
- Artifact [#12150028902](https://github.com/jonhararagi/animeart/actions/runs/39164850908/artifacts/12150028902) exists; the APK is 10,585,112 bytes and its embedded checksum matches the bytes.
- Prior artifact [#12132190553](https://github.com/jonhararagi/animeart/actions/runs/39114643622/artifacts/12132190553) also had a matching embedded checksum.
- The signer certificate SHA-256 values are different across those artifacts. The previous workflow therefore did **not** provide reliable in-place update compatibility, even with the same application ID.
- Emulator validation is not a physical test on Xiaomi `24116RACCG`.

## Changes in this patch

- Add optional stable signing that reads its keystore and passwords only from GitHub Actions secrets.
- Mark no-secret builds as `ephemeral-debug`; fail if only part of the secret set is configured.
- Verify signer, package ID, version, and checksum; write a signer fingerprint report and optionally pin the certificate with a repository variable.
- Bump Android to `0.3.1` / version code `4`.

## Status

**PARTIAL until the new main workflow completes, stable signing secrets are configured, and physical device validation is performed.** Without the secrets, CI can publish a fresh-install APK, but does not guarantee update compatibility.
