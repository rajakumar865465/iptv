class AppConstants {
  static const String appName = 'NivaTV';
  // Fix #6 & #30: Removed duplicate baseUrl — use BackendConfig.baseUrl everywhere.
  // AppConstants.baseUrl previously pointed to the emulator (10.0.2.2:5000) which
  // breaks on real devices. BackendConfig is the single source of truth for the URL.
  static const String apiVersion = 'v1';
  static const String appVersion = '1.0.0'; // Update with each release
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
}

class AppColors {
  // ── NivaTV Premium Dark Theme ──────────────────────────────────────────────
  // Core: Deep navy-black base inspired by JioTV/Airtel Xstream premium OTT look
  static const int primary = 0xFF1A56DB;         // NivaTV Blue (primary brand)
  static const int brandRed = 0xFFE5091A;        // NivaTV Red accent (secondary brand)
  static const int premiumGold = 0xFFFFB300;     // Premium / PRO badge color

  // Backgrounds — deep black with slight warm navy tint
  static const int background = 0xFF0A0A12;      // Deep navy-black
  static const int backgroundAlt = 0xFF0F0F1A;   // Slightly lighter navy-black
  static const int surface = 0xFF16161F;         // Card surface
  static const int surfaceElevated = 0xFF1E1E2E; // Elevated cards/sheets
  static const int surfaceLight = 0xFF252535;    // Input backgrounds, chips
  static const int divider = 0xFF252535;         // Subtle dividers

  // Text hierarchy
  static const int textPrimary = 0xFFFFFFFF;     // Headings
  static const int textSecondary = 0xFFB8BCC8;   // Subheadings / labels
  static const int textMuted = 0xFF6B7080;       // Disabled / hint text
  static const int textOnBrand = 0xFFFFFFFF;     // Text on colored buttons

  // Legacy alias (accent = primary for backwards compat)
  static const int accent = 0xFF1A56DB;

  // Semantic colors
  static const int liveRed = 0xFFE5091A;
  static const int success = 0xFF22C55E;
  static const int warning = 0xFFF59E0B;
  static const int error = 0xFFEF4444;

  // Cards / gradients
  static const int cardGradientStart = 0xFF1E1E2E;
  static const int cardGradientEnd = 0xFF16161F;

  // Shimmer (slightly brighter than background for subtlety)
  static const int shimmerBase = 0xFF1E1E2E;
  static const int shimmerHighlight = 0xFF2A2A3E;

  // Bottom nav
  static const int navBackground = 0xFF0A0A12;
  static const int navIndicator = 0xFF1A56DB;   // Blue indicator pill
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
  static const String channelDetails = '$channels'; // GET /:id
  static const String channelPlayback = '$channels'; // GET /:id/playback
  static const String channelSmoothPlayback = '$channels'; // GET /:id/smooth-playback
  static const String channelReportFailure = '$channels'; // POST /:id/report-failure
  static const String channelPlaybackResult = '$channels'; // POST /:id/playback-result
  static const String channelDisplayReport = '$channels'; // POST /:id/display-report
  static const String channelEPGNow = '$channels'; // GET /:id/epg/now
  static const String channelEPGUpcoming = '$channels'; // GET /:id/epg/upcoming
  static const String channelRelated = '$channels'; // GET /:id/related

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
}
