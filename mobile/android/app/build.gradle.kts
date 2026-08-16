import java.io.FileInputStream
import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Load signing config from android/key.properties if present. This file is
// git-ignored and must be created locally (or provided by CI) before a
// release build can be signed. See README.md for how to generate one.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.iptv.iptv_app"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.iptv.iptv_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }


    buildTypes {
        release {
            // Release builds must be signed with a real release keystore,
            // configured via android/key.properties (never committed to
            // git). We deliberately do NOT fall back to the debug keystore
            // here — shipping a release APK signed with the debug key is a
            // security issue (anyone with the AOSP debug key could produce
            // an update that looks legitimately signed).
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                null
            }
        }
    }
}

// Fail any release build (assemble/bundle/install) if no key.properties was
// found, instead of silently signing with the debug keystore.
gradle.taskGraph.whenReady {
    val releaseRun = gradle.taskGraph.allTasks.any {
        it.path.startsWith(project.path) && it.name.contains("Release", ignoreCase = true)
    }
    if (releaseRun && !keystorePropertiesFile.exists()) {
        throw GradleException(
            "Release build requested but android/key.properties is missing.\n" +
                "Create android/key.properties with keyAlias, keyPassword, storeFile, " +
                "and storePassword pointing at a real release keystore — see README.md " +
                "for instructions. Release builds must never be signed with the debug keystore."
        )
    }
}

// Fail release builds if BACKEND_URL is not supplied via --dart-define.
// The Flutter Gradle plugin exposes dart-defines as the comma-separated
// `flutter.dartDefines` project property. We parse it and abort the release
// build if BACKEND_URL is missing or blank, so an APK never ships with an
// empty backend (which would only show the configuration-error screen).
val flutterDefines: String = (project.findProperty("flutter.dartDefines") as? String) ?: ""
val dartDefineMap: MutableMap<String, String> = flutterDefines
    .split(",")
    .filter { it.isNotBlank() }
    .map { String(Base64.getDecoder().decode(it), Charsets.UTF_8) }
    .filter { it.contains("=") }
    .associate {
        val i = it.indexOf("=")
        it.substring(0, i).trim() to it.substring(i + 1).trim()
    }
    .toMutableMap()

// Flutter 3.44+ may expose individual dart-defines as project properties.
if (dartDefineMap["BACKEND_URL"].isNullOrBlank()) {
    project.findProperty("flutter.BACKEND_URL")?.toString()?.takeIf { it.isNotBlank() }?.let {
        dartDefineMap["BACKEND_URL"] = it
    }
    project.findProperty("BACKEND_URL")?.toString()?.takeIf { it.isNotBlank() }?.let {
        dartDefineMap["BACKEND_URL"] = it
    }
}

// Fallback: read from local.properties (useful when --dart-define isn't passed to Gradle).
if (dartDefineMap["BACKEND_URL"].isNullOrBlank()) {
    val localProps = Properties()
    val localPropsFile = rootProject.file("local.properties")
    if (localPropsFile.exists()) {
        localProps.load(localPropsFile.inputStream())
        val url = localProps.getProperty("BACKEND_URL", "")
        if (url.isNotBlank()) {
            dartDefineMap["BACKEND_URL"] = url
        }
    }
}

val backendUrlMissing: Boolean = dartDefineMap["BACKEND_URL"].isNullOrBlank()

gradle.taskGraph.whenReady {
    val releaseRun = gradle.taskGraph.allTasks.any {
        it.name.contains("Release", ignoreCase = true)
    }
    if (backendUrlMissing && releaseRun) {
        throw GradleException(
            "\n[BUILD FAILED] BACKEND_URL not provided via --dart-define.\n" +
                "Release builds must explicitly specify the backend URL, e.g.:\n" +
                "  flutter build apk --release --dart-define=BACKEND_URL=https://44.206.18.189\n" +
                "An APK must never ship pointing at a blank/default backend."
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
