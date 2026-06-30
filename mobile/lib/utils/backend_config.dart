import 'package:flutter/foundation.dart';

/// Backend configuration loaded at build time via --dart-define.
///
/// Usage (development):
///   flutter run --dart-define=BACKEND_URL=https://35.154.128.217
///
/// Usage (production build):
///   flutter build apk --dart-define=BACKEND_URL=https://api.yourdomain.com
///
/// If BACKEND_URL is not supplied, falls back to the production HTTPS URL.
/// Never hardcode the IP directly in source — use --dart-define or a CI secret.
class BackendConfig {
  static const bool isDev = !kReleaseMode;

  static const String baseUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: isDev ? 'http://localhost:5000' : 'http://35.154.128.217',
  );
}
