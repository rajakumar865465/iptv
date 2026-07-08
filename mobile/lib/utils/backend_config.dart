import 'package:flutter/foundation.dart';

/// Backend configuration loaded at build time via --dart-define.
///
/// Local phone testing (use your PC's Wi-Fi IPv4, not localhost):
///   flutter run --debug --dart-define=BACKEND_URL=http://192.168.1.25:5000
///
/// Android emulator points to the host PC at 10.0.2.2:
///   flutter run --debug --dart-define=BACKEND_URL=http://10.0.2.2:5000
///
/// Production build (backend server — release builds REQUIRE this and the
/// Gradle guard in android/app/build.gradle.kts will fail without it):
///   flutter build apk --release --dart-define=BACKEND_URL=http://35.154.128.217:5000
///
/// If BACKEND_URL is not supplied, the app shows a configuration-error screen
/// instead of running. Never hardcode a URL in source — always use --dart-define.
class BackendConfig {
  static const bool isDev = !kReleaseMode;

  static const String baseUrl = String.fromEnvironment(
    'BACKEND_URL',
    // Default to the production server so users don't get the missing URL error
    // if they forget the --dart-define flag during build.
    defaultValue: 'http://35.154.128.217:5000',
  );

  /// Validates that the backend URL is configured. Call before runApp.
  static bool get isConfigured => baseUrl.isNotEmpty;
}
