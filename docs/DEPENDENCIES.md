# Dependencies

| Dependency | Version | Reason | License | Component | Maintenance risk |
|---|---|---|---|---|---|
| Gradle Wrapper | 8.14.5 | Reproducible Android build; distribution SHA-256 verified | Apache-2.0 | Build/CI | Low |\n| Android Gradle Plugin | 8.7.3 | Android build | Apache-2.0 | Build | Low |
| Kotlin / Compose compiler plugin | 2.3.0 | Aligned Kotlin and Compose compiler plugins | Apache-2.0 | All Kotlin/UI | Medium until CI validates the upgrade |
| Compose BOM | 2025.01.00 | UI foundation | Apache-2.0 | UI/editor | Low |
| AndroidX Core KTX | 1.15.0 | Android Kotlin APIs | Apache-2.0 | App | Low |
| Activity Compose | 1.10.1 | Compose activity integration | Apache-2.0 | App/UI | Low |
| Lifecycle Runtime Compose | 2.8.7 | Lifecycle-aware Compose support | Apache-2.0 | UI | Low |
| Material 3 | BOM-managed | Material components | Apache-2.0 | UI | Low |

No external image-processing or AI dependency is introduced on Day 1.


The Android CI uses `./gradlew` exclusively. `gradle/wrapper/gradle-wrapper.properties` pins `gradle-8.14.5-bin.zip` and its SHA-256 checksum from the official Gradle checksum reference. Java 17, AGP 8.7.3, SDK levels, and application libraries remain unchanged.

Local Android validation (JDK 17 and Android SDK required):

```bash
./gradlew --version
./gradlew assembleDebug
./gradlew test
./gradlew lintDebug
./gradlew connectedDebugAndroidTest
bash scripts/android-startup-smoke.sh
```
