import 'dart:developer' as developer;
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import 'token_refresh_service.dart';

import '../utils/backend_config.dart';

class ApiService {
  late Dio _dio;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: BackendConfig.baseUrl,
      connectTimeout: const Duration(milliseconds: AppConstants.connectTimeout),
      receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeout),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString(StorageKeys.token);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        // Debug log the final API URL
        developer.log(
          '[API Request] ${options.method} ${options.baseUrl}${options.path} | Query: ${options.queryParameters}',
          name: 'ApiService',
        );
        return handler.next(options);
      },
      onResponse: (response, handler) {
        developer.log(
          '[API Response] ${response.statusCode} ${response.requestOptions.path}',
          name: 'ApiService',
        );
        return handler.next(response);
      },
      onError: (error, handler) async {
        developer.log(
          '[API Error] ${error.response?.statusCode} ${error.requestOptions.path} | ${error.message}',
          name: 'ApiService',
        );
        if (error.response?.statusCode == 401 || error.response?.statusCode == 403) {
          final data = error.response?.data;
          bool isTokenError = false;

          if (data is Map && data['message'] != null) {
            final msg = data['message'].toString().toLowerCase();
            if (msg.contains('invalid token') || msg.contains('token expired') || (error.response?.statusCode == 403 && data['error'] != 'DEVICE_LIMIT_REACHED')) {
              isTokenError = true;
            }
          } else if (error.response?.statusCode == 403) {
            isTokenError = true;
          }

          if (isTokenError) {
            // Don't refresh the token request itself, and only retry once per
            // request to avoid an infinite loop if the refresh is unusable.
            final req = error.requestOptions;
            final alreadyRetried = req.extra['refreshed'] == true;
            final isRefreshCall = req.path.contains(ApiEndpoints.refreshToken);

            if (!isRefreshCall && !alreadyRetried) {
              developer.log('[API] Access token expired — attempting refresh + retry.', name: 'ApiService');
              final ok = await TokenRefreshService.instance.refresh();
              if (ok) {
                try {
                  final prefs = await SharedPreferences.getInstance();
                  final newToken = prefs.getString(StorageKeys.token);
                  if (newToken != null) {
                    req.headers['Authorization'] = 'Bearer $newToken';
                  }
                  req.extra['refreshed'] = true;
                  // Replay the original request with the fresh token.
                  final response = await _dio.fetch(req);
                  return handler.resolve(response);
                } catch (retryErr) {
                  developer.log('[API] Retry after refresh failed: $retryErr', name: 'ApiService');
                  return handler.next(error);
                }
              }
            }
            developer.log('[API] Refresh failed or unavailable — clearing session.', name: 'ApiService');
            await _clearToken();
          } else {
            developer.log('[API] 401 received but not a token expiration, preserving session.', name: 'ApiService');
          }
        }
        return handler.next(error);
      },
    ));
  }

  Future<void> _clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.token);
    await prefs.remove(StorageKeys.refreshToken);
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? queryParameters}) async {
    final response = await _dio.get<Map<String, dynamic>>(path, queryParameters: queryParameters);
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> post(String path, dynamic data) async {
    final response = await _dio.post<Map<String, dynamic>>(path, data: data);
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> put(String path, dynamic data) async {
    final response = await _dio.put<Map<String, dynamic>>(path, data: data);
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _dio.delete<Map<String, dynamic>>(path);
    return response.data ?? {};
  }

  /// Generic request for non-JSON responses (e.g., plain text/plan arrays).
  Future<dynamic> requestDynamic(String method, String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    final response = await _dio.request(
      path,
      data: data,
      queryParameters: queryParameters,
      options: Options(method: method),
    );
    return response.data;
  }
}

