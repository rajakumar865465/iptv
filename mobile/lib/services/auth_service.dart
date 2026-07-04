import 'package:dio/dio.dart';
import '../constants.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/backend_config.dart';

class AuthUserResult {
  final int userId;
  final String token;
  final String? refreshToken;
  final String userStatus;
  final String licenseStatus;
  final Map<String, dynamic>? license;

  AuthUserResult({
    required this.userId,
    required this.token,
    this.refreshToken,
    required this.userStatus,
    required this.licenseStatus,
    this.license,
  });
}

class AuthService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: BackendConfig.baseUrl,
    connectTimeout: const Duration(milliseconds: AppConstants.connectTimeout),
    receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeout),
    headers: {'Content-Type': 'application/json'},
  ));

  String? _token;

  AuthService() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_token != null) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        return handler.next(options);
      },
    ));
  }

  void setToken(String? token) {
    _token = token;
  }

  Future<AuthUserResult?> signup({
    required String fullName,
    required String email,
    required String mobile,
    required String password,
  }) async {
    final response = await _dio.post(ApiEndpoints.signup, data: {
      'full_name': fullName,
      'email': email,
      'mobile': mobile,
      'password': password,
      'confirm_password': password,
    });

    return _parseAuthResponse(response.data);
  }

  Future<AuthUserResult?> login({
    required String email,
    required String password,
    required String deviceId,
    String? deviceName,
    bool forceLogoutOldest = false,
  }) async {
    final response = await _dio.post(ApiEndpoints.login, data: {
      'email': email,
      'password': password,
      'device_id': deviceId,
      'device_name': deviceName ?? 'Unknown Device',
      'app_version': AppConstants.appVersion,
      'force_logout_oldest': forceLogoutOldest,
    });

    return _parseAuthResponse(response.data);
  }

  AuthUserResult? _parseAuthResponse(Map<String, dynamic> data) {
    if (data['success'] == true && data['data'] != null) {
      final d = data['data'];
      return AuthUserResult(
        userId: d['user']['id'],
        token: d['token'],
        refreshToken: d['refreshToken']?.toString(),
        userStatus: d['user_status'] ?? 'active',
        licenseStatus: d['license_status'] ?? 'none',
        license: d['license'],
      );
    }
    return null;
  }

  /// Exchanges a stored refresh token for a fresh access + refresh token pair.
  /// Returns null if the refresh token is missing, invalid, or the server
  /// refused the rotation (caller must then sign the user out).
  Future<AuthUserResult?> refreshToken(String refreshToken) async {
    try {
      final response = await _dio.post(ApiEndpoints.refreshToken, data: {
        'refreshToken': refreshToken,
      });
      return _parseRefreshResponse(response.data);
    } catch (_) {
      return null;
    }
  }

  AuthUserResult? _parseRefreshResponse(Map<String, dynamic> data) {
    if (data['success'] == true && data['data'] != null) {
      final d = data['data'];
      return AuthUserResult(
        userId: d['user']?['id'] ?? 0,
        token: d['token'],
        refreshToken: d['refreshToken']?.toString(),
        userStatus: 'active',
        licenseStatus: 'none',
      );
    }
    return null;
  }

  Future<void> saveSession(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.token, token);
  }

  Future<void> saveRefreshSession(String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.refreshToken, refreshToken);
  }

  Future<String?> getRefreshSession() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(StorageKeys.refreshToken);
  }

  Future<String?> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(StorageKeys.token);
  }

  Future<Map<String, dynamic>?> me() async {
    try {
      final response = await _dio.get(ApiEndpoints.me);
      if (response.data['success'] == true && response.data['data'] != null) {
        return response.data['data'];
      }
      return null;
    } catch (e) {
      if (e is DioException) rethrow;
      return null;
    }
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.token);
    await prefs.remove(StorageKeys.refreshToken);
    _token = null;
  }
}
