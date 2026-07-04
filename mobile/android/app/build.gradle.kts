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
val flutterDefines: String? = (project.findProperty("flutter.dartDefines") as? String?)
val dartDefineMap: Map<String, String> = flutterDefines
    ?.split(",")
    ?.filter { it.contains("=") }
    ?.associate {
        val i = it.indexOf("=")
        it.substring(0, i).trim() to it.substring(i + 1).trim()
    }
    ?: emptyMap()

val backendUrlMissing: Boolean = dartDefineMap["BACKEND_URL"].isNullOrBlank()

gradle.taskGraph.whenReady {
    val releaseRun = gradle.taskGraph.allTasks.any {
        it.name.contains("Release", ignoreCase = true)
    }
    if (backendUrlMissing && releaseRun) {
        throw GradleException(
            "\n[BACKEND_URL] Production build aborted: BACKEND_URL was not provided.\n" +
            "Rebuild with:\n" +
            "  flutter build apk --release --dart-define=BACKEND_URL=http://35.154.128.217\n" +
            "For local phone testing use your PC's Wi-Fi IPv4, e.g. http://192.168.1.25:5000.\n"
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
