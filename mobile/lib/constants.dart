class AppConstants {
  static const String appName = 'IPTV Live TV';
  // Use 10.0.2.2:5000 for Android emulator (localhost alias)
  // For production, use: https://iptv-6vbq.onrender.com
  static const String baseUrl = 'http://10.0.2.2:5000';
  static const String apiVersion = 'v1';
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
}

class AppColors {
  // Dark theme colors (JioTV-like)
  static const int primary = 0xFFE50914;
  static const int background = 0xFF121212;
  static const int surface = 0xFF1E1E1E;
  static const int surfaceLight = 0xFF2C2C2C;
  static const int textPrimary = 0xFFFFFFFF;
  static const int textSecondary = 0xFFB3B3B3;
  static const int textMuted = 0xFF757575;
  static const int accent = 0xFFE50914;
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
  static const String channelSearch = '$channels/search';

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
  static const String user = 'user_data';
  static const String deviceId = 'device_id';
  static const String isFirstLaunch = 'is_first_launch';
  static const String hasSeenOnboarding = 'has_seen_onboarding';
}
