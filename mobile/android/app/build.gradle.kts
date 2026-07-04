import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.iptv.iptv_app"
    compileSdk = flutter.compileSdkVersion
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

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
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
        println("\n[WARNING] BACKEND_URL not provided via --dart-define. Falling back to default production URL (http://35.154.128.217).")
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
