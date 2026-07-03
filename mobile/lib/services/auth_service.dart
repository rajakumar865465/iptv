import 'package:dio/dio.dart';
import '../constants.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/backend_config.dart';

class AuthUserResult {
  final int userId;
  final String token;
  final String userStatus;
  final String licenseStatus;
  final Map<String, dynamic>? license;

  AuthUserResult({
    required this.userId,
    required this.token,
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
        userStatus: d['user_status'] ?? 'active',
        licenseStatus: d['license_status'] ?? 'none',
        license: d['license'],
      );
    }
    return null;
  }

  Future<void> saveSession(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.token, token);
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
    _token = null;
  }
}
