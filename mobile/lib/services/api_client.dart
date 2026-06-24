import 'package:dio/dio.dart';
import '../constants.dart';
import 'auth_service.dart';

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
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          _authService.clearSession();
        }
        return handler.next(error);
      },
    ));
  }

  Dio get dio => _dio;
}
