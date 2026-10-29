import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val generatedWebAssets = layout.buildDirectory.dir("generated/animeartWebAssets")

// Stable APK signing is optional locally and is supplied only through private CI secrets.
val stableKeystorePath = providers.environmentVariable("ANIMEART_KEYSTORE_PATH").orNull
val stableKeystorePassword = providers.environmentVariable("ANIMEART_KEYSTORE_PASSWORD").orNull
val stableKeyAlias = providers.environmentVariable("ANIMEART_KEY_ALIAS").orNull
val stableKeyPassword = providers.environmentVariable("ANIMEART_KEY_PASSWORD").orNull
val hasStableSigning = listOf(
    stableKeystorePath,
    stableKeystorePassword,
    stableKeyAlias,
    stableKeyPassword
).all { !it.isNullOrBlank() }
val syncWebEditorAssets = tasks.register<Sync>("syncWebEditorAssets") {
    from(rootProject.file("web")) {
        into("web")
        exclude(
            "dist/**",
            "node_modules/**",
            "scripts/**",
            "test/**",
            "tests/**",
            "package.json",
            "package-lock.json",
            "README.md",
            ".gitignore"
        )
    }
    into(generatedWebAssets)

    // The APK must always be rebuilt from the canonical web tree, never a cached editor shell.
    outputs.cacheIf("Always sync the canonical Web editor into Android assets") { false }
    outputs.upToDateWhen { false }

    doLast {
        val sourceIndex = rootProject.file("web/index.html")
        val copiedIndex = generatedWebAssets.get().file("web/index.html").asFile
        check(sourceIndex.isFile && copiedIndex.isFile) {
            "Expected the canonical and generated Web index files. source=${sourceIndex.absolutePath}, generated=${copiedIndex.absolutePath}"
        }
        val sourceHtml = sourceIndex.readText(Charsets.UTF_8)
        val copiedHtml = copiedIndex.readText(Charsets.UTF_8)
        check(
            sourceHtml.contains("layer-group-selection") && sourceHtml.contains("layer-ungroup-selection") &&
            copiedHtml.contains("layer-group-selection") && copiedHtml.contains("layer-ungroup-selection")
        ) {
            "The generated Android Web assets differ from the canonical editor or omit layer grouping controls."
        }
    }
}

android {
    signingConfigs {
        if (hasStableSigning) {
            create("animeArtStable") {
                storeFile = file(stableKeystorePath!!)
                storeType = "JKS"
                storePassword = stableKeystorePassword!!
                keyAlias = stableKeyAlias!!
                keyPassword = stableKeyPassword!!
            }
        }
    }

    namespace = "com.jonhararagi.animeart"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.jonhararagi.animeart"
        minSdk = 24
        targetSdk = 35
        versionCode = 10
        versionName = "0.3.7"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        getByName("debug") {
            if (hasStableSigning) {
                signingConfig = signingConfigs.getByName("animeArtStable")
            }
        }
    }

    buildFeatures {
        compose = true
    }

    sourceSets.getByName("main").assets.setSrcDirs(listOf(generatedWebAssets.get().asFile))
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.01.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.webkit:webkit:1.15.0")

    testImplementation("junit:junit:4.13.2")

    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}


tasks.named("preBuild").configure {
    dependsOn(syncWebEditorAssets)
}

// Asset merging must consume the just-synced editor, not a cached intermediate copy.
tasks.matching { it.name in setOf("mergeDebugAssets", "mergeReleaseAssets", "compressDebugAssets", "compressReleaseAssets", "packageDebug", "packageRelease") }.configureEach {
    dependsOn(syncWebEditorAssets)
    outputs.cacheIf("Merge freshly synchronized editor assets") { false }
    outputs.upToDateWhen { false }
}
