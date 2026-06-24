import 'dart:developer' as developer;
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

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
      onError: (error, handler) {
        developer.log(
          '[API Error] ${error.response?.statusCode} ${error.requestOptions.path} | ${error.message}',
          name: 'ApiService',
        );
        if (error.response?.statusCode == 401) {
          _clearToken();
        }
        return handler.next(error);
      },
    ));
  }

  Future<void> _clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.token);
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? queryParameters}) async {
    final response = await _dio.get(path, queryParameters: queryParameters);
    return response.data;
  }

  Future<Map<String, dynamic>> post(String path, dynamic data) async {
    final response = await _dio.post(path, data: data);
    return response.data;
  }

  Future<Map<String, dynamic>> put(String path, dynamic data) async {
    final response = await _dio.put(path, data: data);
    return response.data;
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _dio.delete(path);
    return response.data;
  }
}

