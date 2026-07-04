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
  // Dark theme colors (JioTV-like)
  static const int primary = 0xFF1A56DB;
  static const int background = 0xFF121212;
  static const int surface = 0xFF1E1E1E;
  static const int surfaceLight = 0xFF2C2C2C;
  static const int textPrimary = 0xFFFFFFFF;
  static const int textSecondary = 0xFFB3B3B3;
  static const int textMuted = 0xFF757575;
  static const int accent = 0xFF1A56DB;
  static const int liveRed = 0xFFFF0000;
  static const int success = 0xFF4CAF50;
  static const int warning = 0xFFFF9800;
  static const int error = 0xFFF44336;
  static const int cardGradientStart = 0xFF2A2A2A;
  static const int cardGradientEnd = 0xFF1A1A1A;
  static const int shimmerBase = 0xFF2C2C2C;
  static const int shimmerHighlight = 0xFF3C3C3C;
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
