import 'package:dio/dio.dart';
import '../constants.dart';
import 'auth_service.dart';
import 'token_refresh_service.dart';

import '../utils/backend_config.dart';

class ApiClient {
  late Dio _dio;
  final AuthService _authService;

  ApiClient({AuthService? authService})
      : _authService = authService ?? AuthService();

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: BackendConfig.baseUrl,
      connectTimeout: const Duration(milliseconds: AppConstants.connectTimeout),
      receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeout),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authService.getSession();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401 || error.response?.statusCode == 403) {
          final data = error.response?.data;
          bool isTokenError = false;
          if (data is Map && data['message'] != null) {
            final msg = data['message'].toString().toLowerCase();
            if (msg.contains('invalid token') || msg.contains('token expired') || error.response?.statusCode == 403) {
              isTokenError = true;
            }
          }
          if (isTokenError) {
            final req = error.requestOptions;
            final alreadyRetried = req.extra['refreshed'] == true;
            final isRefreshCall = req.path.contains(ApiEndpoints.refreshToken);

            if (!isRefreshCall && !alreadyRetried) {
              final ok = await TokenRefreshService.instance.refresh();
              if (ok) {
                try {
                  final newToken = await _authService.getSession();
                  if (newToken != null) {
                    req.headers['Authorization'] = 'Bearer $newToken';
                  }
                  req.extra['refreshed'] = true;
                  final response = await _dio.fetch(req);
                  return handler.resolve(response);
                } catch (_) {
                  return handler.next(error);
                }
              }
            }
            await _authService.clearSession();
          }
        }
        return handler.next(error);
      },
    ));
  }

  Dio get dio => _dio;
}
