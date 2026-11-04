import 'package:flutter/material.dart';

class AppConstants {
  static const String appName = 'NivaTV';
  // Fix #6 & #30: Removed duplicate baseUrl — use BackendConfig.baseUrl everywhere.
  // AppConstants.baseUrl previously pointed to the emulator (10.0.2.2:5000) which
  // breaks on real devices. BackendConfig is the single source of truth for the URL.
  static const String apiVersion = 'v1';
  static const String appVersion = '2.8.2'; // Synchronized with pubspec.yaml
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
  static const double bottomNavClearance = 108.0;
}

class AppColors {
  // ── NivaTV Premium Dark Theme ──────────────────────────────────────────────
  // Core: Deep obsidian base with Electric Indigo -> Vibrant Crimson brand accents
  static const int primary = 0xFF4F46E5;         // Electric Indigo (primary brand)
  static const int primaryLight = 0xFF818CF8;    // Soft Indigo (for badges/pills in dark mode)
  static const int brandRed = 0xFFE11D48;        // Vibrant Crimson (secondary brand)
  static const int premiumGold = 0xFFFFB300;     // Premium / PRO badge color

  // Backgrounds — deep OLED obsidian with rich indigo-slate elevation
  static const int background = 0xFF07080E;      // Deep OLED obsidian
  static const int backgroundAlt = 0xFF0C0E18;   // Slightly lighter obsidian
  static const int surface = 0xFF111320;         // Card surface
  static const int surfaceElevated = 0xFF1A1D30; // Elevated cards/sheets
  static const int surfaceLight = 0xFF181B2C;    // Input backgrounds, chips
  static const int divider = 0xFF252A44;         // Crisp hairline borders

  // Text hierarchy
  static const int textPrimary = 0xFFFFFFFF;     // Headings
  static const int textSecondary = 0xFFB8C0D4;   // Subheadings / labels
  static const int textMuted = 0xFF727994;       // Disabled / hint text
  static const int textOnBrand = 0xFFFFFFFF;     // Text on colored buttons

  // Legacy alias (accent = primary for backwards compat)
  static const int accent = 0xFF4F46E5;

  // Semantic colors
  static const int liveRed = 0xFFE11D48;
  static const int success = 0xFF10B981;
  static const int warning = 0xFFF59E0B;
  static const int error = 0xFFEF4444;

  // Cards / gradients
  static const int cardGradientStart = 0xFF1A1D30;
  static const int cardGradientEnd = 0xFF111320;

  // Shimmer (layered contrast against card surfaces)
  static const int shimmerBase = 0xFF1A1D30;
  static const int shimmerHighlight = 0xFF2B3050;
  static const int shimmerBaseLight = 0xFFE2E8F0;
  static const int shimmerHighlightLight = 0xFFF8FAFC;

  // Bottom nav
  static const int navBackground = 0xFF0D0F1B;
  static const int navIndicator = 0xFF4F46E5;   // Indigo indicator pill

  // Dynamic Theme-Aware Color Resolvers
  static Color bg(BuildContext context) => AppThemeColors.of(context).background;
  static Color surf(BuildContext context) => AppThemeColors.of(context).surface;
  static Color surfLight(BuildContext context) => AppThemeColors.of(context).surfaceLight;
  static Color surfElevated(BuildContext context) => AppThemeColors.of(context).surfaceElevated;
  static Color div(BuildContext context) => AppThemeColors.of(context).divider;
  static Color text1(BuildContext context) => AppThemeColors.of(context).textPrimary;
  static Color text2(BuildContext context) => AppThemeColors.of(context).textSecondary;
  static Color textM(BuildContext context) => AppThemeColors.of(context).textMuted;
  static Color navBg(BuildContext context) => AppThemeColors.of(context).navBackground;
  static Color shimmerBaseColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? const Color(shimmerBase)
          : const Color(shimmerBaseLight);
  static Color shimmerHighlightColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? const Color(shimmerHighlight)
          : const Color(shimmerHighlightLight);
}

/// Resolved color tokens for Dark and Light modes.
class AppThemeColors {
  final Color background;
  final Color surface;
  final Color surfaceLight;
  final Color surfaceElevated;
  final Color divider;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color navBackground;

  const AppThemeColors({
    required this.background,
    required this.surface,
    required this.surfaceLight,
    required this.surfaceElevated,
    required this.divider,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.navBackground,
  });

  static const dark = AppThemeColors(
    background: Color(AppColors.background),
    surface: Color(AppColors.surface),
    surfaceLight: Color(AppColors.surfaceLight),
    surfaceElevated: Color(AppColors.surfaceElevated),
    divider: Color(AppColors.divider),
    textPrimary: Color(AppColors.textPrimary),
    textSecondary: Color(AppColors.textSecondary),
    textMuted: Color(AppColors.textMuted),
    navBackground: Color(AppColors.navBackground),
  );

  static const light = AppThemeColors(
    background: Color(0xFFF1F5F9),
    surface: Color(0xFFFFFFFF),
    surfaceLight: Color(0xFFF8FAFC),
    surfaceElevated: Color(0xFFFFFFFF),
    divider: Color(0xFFE2E8F0),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF334155),
    textMuted: Color(0xFF64748B),
    navBackground: Color(0xFFFFFFFF),
  );

  static AppThemeColors of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}

class ApiEndpoints {
  static const String base = '/api';
  static const String auth = '$base/auth';
  static const String appConfig = '$base/app';
  static const String license = '$base/license';
  static const String channels = '$base/channels';
  static const String user = '$base/user';
  static const String payments = '$base/payments';

  // Auth
  static const String signup = '$auth/signup';
  static const String login = '$auth/login';
  static const String logout = '$auth/logout';
  static const String forgotPassword = '$auth/forgot-password';
  static const String me = '$auth/me';
  static const String refreshToken = '$auth/refresh-token';
  static const String streamHeartbeat = '$auth/stream-heartbeat';

  // App Config
  static const String config = '$appConfig/config';
  static const String status = '$appConfig/status';
  static const String versionCheck = '$appConfig/version-check';

  // License
  static const String activate = '$license/activate';
  static const String licenseStatus = '$license/status';
  static const String validate = '$license/validate';
  static const String licenseHistory = '$license/history';

  // Channels
  static const String channelList = channels;
  static const String categoryList = '$channels/categories';
  static const String languageList = '$channels/languages';
  static const String channelSearch = '$channels/search';
  static const String channelDetails = channels; // GET /:id
  static const String channelPlayback = channels; // GET /:id/playback
  static const String channelSmoothPlayback = channels; // GET /:id/smooth-playback
  static const String channelReportFailure = channels; // POST /:id/report-failure
  static const String channelPlaybackResult = channels; // POST /:id/playback-result
  static const String channelDisplayReport = channels; // POST /:id/display-report
  static const String channelEPGNow = channels; // GET /:id/epg/now
  static const String channelEPGUpcoming = channels; // GET /:id/epg/upcoming
  static const String channelRelated = channels; // GET /:id/related

  static String channelPlaybackPath(int id) => '$channelPlayback/$id/playback';
  static String channelSmoothPlaybackPath(int id) => '$channelSmoothPlayback/$id/smooth-playback';
  static String channelReportFailurePath(int id) => '$channelReportFailure/$id/report-failure';
  static String channelPlaybackResultPath(int id) => '$channelPlaybackResult/$id/playback-result';
  static String channelDisplayReportPath(int id) => '$channelDisplayReport/$id/display-report';
  static String channelEPGNowPath(int id) => '$channelEPGNow/$id/epg/now';
  static String channelEPGUpcomingPath(int id) => '$channelEPGUpcoming/$id/epg/upcoming';
  static String channelRelatedPath(int id) => '$channelRelated/$id/related';

  // Stream / Proxy / Transcode
  static const String streamTranscode = '$base/stream/transcode';
  static String streamTranscodePath(int channelId, {required String quality}) =>
      '$streamTranscode/$channelId?quality=$quality';

  // Home — DTH-style structured home page
  static const String home = '$base/home';

  // User
  static const String profile = '$user/profile';
  static const String favorites = '$user/favorites';
  static const String watchHistory = '$user/watch-history';
  static const String devices = '$user/devices';
  static const String userFeedback = '$user/feedback';
  static const String userNotifications = '$user/notifications';

  // Payments
  static const String plans = '$payments/plans';
  static const String paymentStatus = '$payments/status';
  static const String manualRequest = '$payments/manual-request';
  static const String paymentHistory = '$payments/history';
}

class StorageKeys {
  static const String token = 'auth_token';
  static const String refreshToken = 'auth_refresh_token';
  static const String user = 'user_data';
  static const String deviceId = 'device_id';
  static const String isFirstLaunch = 'is_first_launch';
  static const String hasSeenOnboarding = 'has_seen_onboarding';
  static const String cachedChannels = 'cached_channels';
  static const String cachedCategories = 'cached_categories';
  static const String notificationsClearedAt = 'notifications_cleared_at';
  static const String watchHistory = 'watch_history';
  static const String themeMode = 'app_theme_mode';
}
