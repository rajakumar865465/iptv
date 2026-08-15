import 'package:dio/dio.dart';
import '../constants.dart';
import '../models/user_model.dart';

import '../utils/backend_config.dart';
import 'storage_service.dart';

class AuthUserResult {
  final int userId;
  final String token;
  final String? refreshToken;
  final String userStatus;
  final String licenseStatus;
  final Map<String, dynamic>? license;
  final UserModel? user;

  AuthUserResult({
    required this.userId,
    required this.token,
    this.refreshToken,
    required this.userStatus,
    required this.licenseStatus,
    this.license,
    this.user,
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
      UserModel? parsedUser;
      try {
        final u = d['user'] as Map<String, dynamic>?;
        if (u != null) {
          parsedUser = UserModel.fromJson({
            'id': u['id'],
            'full_name': u['full_name'] ?? '',
            'email': u['email'] ?? '',
            'mobile': u['mobile'] ?? '',
            'status': u['status'] ?? 'active',
            'role': u['role'] ?? 'user',
            'created_at': u['created_at'] ?? DateTime.now().toIso8601String(),
            'last_login_at': u['last_login_at'],
          });
        }
      } catch (_) {}
      return AuthUserResult(
        userId: d['user']['id'],
        token: d['token'],
        refreshToken: d['refreshToken']?.toString(),
        userStatus: d['user_status'] ?? 'active',
        licenseStatus: d['license_status'] ?? 'none',
        license: d['license'],
        user: parsedUser,
      );
    }
    return null;
  }

  /// Exchanges a stored refresh token for a fresh access + refresh token pair.
  /// Returns null if the refresh token is missing, invalid, or the server
  /// refused the rotation (caller must then sign the user out).
  Future<AuthUserResult?> refreshToken(String refreshToken) async {
    final response = await _dio.post(ApiEndpoints.refreshToken, data: {
      'refreshToken': refreshToken,
    });
    if (response.data is Map<String, dynamic>) {
      return _parseRefreshResponse(response.data);
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      type: DioExceptionType.badResponse,
      error: 'Invalid response format',
    );
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

  // These delegate to StorageService (backed by FlutterSecureStorage for the
  // actual token values) so there's a single place tokens are persisted,
  // instead of a second independent SharedPreferences read/write path.
  final StorageService _storage = StorageService();

  Future<void> saveSession(String token) async {
    await _storage.saveToken(token);
  }

  Future<void> saveRefreshSession(String refreshToken) async {
    await _storage.saveRefreshToken(refreshToken);
  }

  Future<String?> getRefreshSession() async {
    return _storage.getRefreshToken();
  }

  Future<String?> getSession() async {
    return _storage.getToken();
  }

  Future<Map<String, dynamic>?> me() async {
    try {
      final response = await _dio.get(ApiEndpoints.me);
      if (response.data is Map) {
        if (response.data['success'] == true && response.data['data'] != null) {
          return response.data['data'];
        }
        return null; // Explicit failure from backend
      }
      throw DioException(
        requestOptions: response.requestOptions,
        response: response,
        type: DioExceptionType.badResponse,
        error: 'Invalid response format',
      );
    } catch (e) {
      if (e is DioException) rethrow;
      throw Exception('Parse error in /me: $e');
    }
  }

  Future<void> clearSession() async {
    await _storage.clearAuthData();
    _token = null;
  }
}
