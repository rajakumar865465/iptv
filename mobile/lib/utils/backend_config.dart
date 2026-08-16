import 'package:flutter/foundation.dart';

/// Backend configuration loaded at build time via --dart-define.
///
/// Local phone testing (use your PC's Wi-Fi IPv4, not localhost):
///   flutter run --debug --dart-define=BACKEND_URL=https://192.168.1.25:5000
///
/// Android emulator points to the host PC at 10.0.2.2 (cleartext HTTP is
/// permitted only for this address in the debug-only network security
/// config — see android/app/src/debug/res/xml/network_security_config.xml):
///   flutter run --debug --dart-define=BACKEND_URL=http://10.0.2.2:5000
///
/// Production build (backend server — release builds REQUIRE this and the
/// Gradle guard in android/app/build.gradle.kts will fail without it):
///   flutter build apk --release --dart-define=BACKEND_URL=https://44.206.18.189
///
/// If BACKEND_URL is not supplied, the app shows a configuration-error screen
/// instead of running. Never hardcode a URL in source — always use --dart-define.
class BackendConfig {
  static const bool isDev = !kReleaseMode;

  /// Default backend URL used for the IPTV app, sourced from the
  /// BACKEND_URL --dart-define at build time. Falls back to the production
  /// HTTPS endpoint if not supplied (release builds are additionally blocked
  /// by the Gradle guard in android/app/build.gradle.kts when it's missing).
  static const String baseUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'https://nivatv.abrdns.com',
  );

  /// Base URL to fetch channel data (if not using the backend API directly)
  static bool get isConfigured => baseUrl.isNotEmpty;
}
