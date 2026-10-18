# AnimeArt Android signing and update compatibility

## Why this exists

CI previously used the default Gradle debug keystore generated on each GitHub runner. Separate runners can generate separate certificates, so Android may reject an APK as an update even when the package ID is unchanged.

A byte-level audit on 2026-10-18 confirmed different signers in two recently published artifacts:

| Artifact source SHA | APK SHA-256 | Signer certificate SHA-256 |
|---|---|---|
| `922704ba69942e1cb33724a6bf4a45760081b5be` | `160a6d415e13d803c29d070a9982a1b76b0ec215c8c361581064e156ff6a3e21` | `a5506f521e8c9a952fb18a5f66b1d983c1fae770218b878346a2e8a18ce8508b` |
| `c9d8d7ad33cb1c93499aafe480aaaf044604af65` | `2acb1c5ba49a02ff1b3fb5a6ee7237dc87b503835ef19fc24e089e91762fb7de` | `49d97e8842f4f57ece63722105a8def0cf9938cf488ddd7fbf013e7f9de1d6c1` |

Both stored checksum files matched their APK bytes, but their signer fingerprints differed. The application ID alone is not enough for in-place updates.

## Configure stable signing

**Never commit a keystore or passwords to this public repository.** Create one local JKS keystore, keep a secure backup, and use it for future update-compatible APKs. For example, run `keytool -genkeypair -v -keystore animeart-signing.jks -storetype JKS -keyalg RSA -keysize 3072 -validity 10000 -alias animeart`; enter passwords interactively.

In **Settings → Secrets and variables → Actions**, add these repository secrets:

- `ANIMEART_KEYSTORE_BASE64`: Base64 text for the complete JKS file.
- `ANIMEART_KEYSTORE_PASSWORD`: keystore password.
- `ANIMEART_KEY_ALIAS`: alias, for example `animeart`.
- `ANIMEART_KEY_PASSWORD`: alias password.

In Windows PowerShell, copy the Base64 form with:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("animeart-signing.jks")) | Set-Clipboard
```

After adding the secrets, rerun Android CI on `main`. The signing-secret step is restricted to pushes to `main` and manual workflow dispatches on `main`; pull-request builds do not receive these credentials. The workflow signs with this key, verifies the signature using `apksigner`, verifies package/version via `aapt`, checks the checksum, and includes a `.signing.txt` report in the artifact.

Optional: set the non-secret repository variable `ANIMEART_EXPECTED_CERT_SHA256` to the lowercase certificate fingerprint from that report. CI fails if the signer unexpectedly changes.

## Existing installations

The old CI artifacts above have different fingerprints. A new key cannot recreate an older signature unless its matching private key still exists in a secure keystore. If you cannot recover the key that signed the APK already installed on your phone, Android requires a one-time uninstall before installing the new stable-signed build. Export or back up local artwork/projects first because uninstalling removes app-local data. After installing a build signed with the stable key, subsequent builds can update it as long as the application ID remains `com.jonhararagi.animeart` and the version code increases.

## Fallback behavior

When no signing secrets are set, CI continues producing a debug APK for fresh-install testing, but marks it `ephemeral-debug` and emits a warning that update compatibility is not guaranteed. If only some signing secrets are set, CI fails rather than silently generating an ambiguously signed artifact.
