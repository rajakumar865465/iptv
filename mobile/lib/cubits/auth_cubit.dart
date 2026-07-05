import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import '../services/token_refresh_service.dart';

// States
abstract class AuthState {}

class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState {}
class AuthUnauthenticated extends AuthState {}
class AuthError extends AuthState {
  final String message;
  AuthError(this.message);
}

class AuthDeviceLimitReached extends AuthState {
  final String email;
  final String password;
  final String message;
  AuthDeviceLimitReached(this.email, this.password, this.message);
}

class AuthCubit extends Cubit<AuthState> {
  AuthCubit() : super(AuthInitial());

  final AuthService _authService = AuthService();
  final StorageService _storage = StorageService();

  Future<void> login(String email, String password, {String? deviceId, String? deviceName, bool forceLogoutOldest = false}) async {
    emit(AuthLoading());
    try {
      final actualDeviceId = deviceId ?? await _storage.getDeviceId();
      final result = await _authService.login(
        email: email,
        password: password,
        deviceId: actualDeviceId,
        deviceName: deviceName,
        forceLogoutOldest: forceLogoutOldest,
      );
      if (result != null) {
        await _storage.saveToken(result.token);
        if (result.refreshToken != null && result.refreshToken!.isNotEmpty) {
          await _storage.saveRefreshToken(result.refreshToken!);
        }
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Login failed'));
      }
    } catch (e) {
      if (e is DioException) {
        final statusCode = e.response?.statusCode;
        final data = e.response?.data;
        String message = 'Login failed. Please check your credentials.';

        // First try to extract message from JSON response body
        if (data is Map<String, dynamic> && data['message'] != null) {
          if (data['error'] == 'DEVICE_LIMIT_REACHED') {
            emit(AuthDeviceLimitReached(email, password, data['message'].toString()));
            return;
          }
          message = data['message'].toString();
        } else if (statusCode == 401) {
          message = 'Invalid email or password.';
        } else if (statusCode == 403) {
          message = 'Access denied. Please contact support.';
        } else if (statusCode != null && statusCode >= 500) {
          message = 'Server error. Please try again later.';
        } else if (e.type == DioExceptionType.connectionTimeout ||
                   e.type == DioExceptionType.receiveTimeout) {
          message = 'Connection timed out. Please try again.';
        } else if (e.type == DioExceptionType.connectionError) {
          message = 'Cannot connect to server. Please check your internet.';
        }
        emit(AuthError(message));
      } else {
        emit(AuthError('An unexpected error occurred. Please try again.'));
      }
    }
  }

  Future<void> signup(String fullName, String email, String mobile, String password) async {
    emit(AuthLoading());
    try {
      final result = await _authService.signup(
        fullName: fullName,
        email: email,
        mobile: mobile,
        password: password,
      );
      if (result != null) {
        await _storage.saveToken(result.token);
        if (result.refreshToken != null && result.refreshToken!.isNotEmpty) {
          await _storage.saveRefreshToken(result.refreshToken!);
        }
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Signup failed'));
      }
    } catch (e) {
      if (e is DioException) {
        final statusCode = e.response?.statusCode;
        final data = e.response?.data;
        String message = 'Signup failed. Please try again.';
        if (data is Map<String, dynamic> && data['message'] != null) {
          message = data['message'].toString();
        } else if (statusCode == 409) {
          message = 'Email or mobile number already registered.';
        } else if (statusCode != null && statusCode >= 500) {
          message = 'Server error. Please try again later.';
        } else if (e.type == DioExceptionType.connectionTimeout ||
                   e.type == DioExceptionType.receiveTimeout) {
          message = 'Connection timed out. Please try again.';
        } else if (e.type == DioExceptionType.connectionError) {
          message = 'Cannot connect to server. Please check your internet.';
        }
        emit(AuthError(message));
      } else {
        emit(AuthError('An unexpected error occurred. Please try again.'));
      }
    }
  }

  Future<void> checkAuth() async {
    final token = await _storage.getToken();
    if (token != null) {
      _authService.setToken(token);
      try {
        final meResult = await _authService.me();
        if (meResult != null) {
          emit(AuthAuthenticated());
        } else {
          // /me returned 200 but success=false — session is explicitly invalid.
          // Use clearAuthData (not clearAll) to preserve onboarding/device ID.
          await _storage.clearAuthData();
          emit(AuthUnauthenticated());
        }
      } catch (e) {
        if (e is DioException && (e.response?.statusCode == 401 || e.response?.statusCode == 403)) {
          // Confirmed invalid token — clear auth data only, preserve app settings.
          await _storage.clearAuthData();
          emit(AuthUnauthenticated());
          return;
        }
        // Fix #22: Only treat network/connectivity errors as "offline authenticated".
        // Server 500s or unknown errors should NOT silently pass the auth gate.
        if (e is DioException && (
          e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout
        )) {
          // Genuine network outage — allow offline access
          emit(AuthAuthenticated());
        } else {
          // Any other error (5xx, unknown) — treat as temporary server issue.
          // Re-authenticating on 5xx is unsafe — don't silently pass users through.
          emit(AuthError('Server temporarily unavailable. Please try again later.'));
          return;
        }
      }
    } else {
      emit(AuthUnauthenticated());
    }
  }

  void setToken(String token) {
    _authService.setToken(token);
  }

  /// Proactively exchanges the stored refresh token for a fresh access token.
  /// Called during app startup so a user whose 15-minute access token has
  /// expired can still resume their session without re-entering credentials.
  /// Returns true on success.
  Future<bool> tryRefresh() async {
    return TokenRefreshService.instance.refresh();
  }

  Future<Map<String, dynamic>?> me({bool throwOnError = false}) async {
    try {
      final result = await _authService.me();
      return result;
    } catch (e) {
      if (throwOnError) rethrow;
      return null;
    }
  }

  Future<void> logout() async {
    await _authService.clearSession();
    await _storage.clearAll();
    emit(AuthUnauthenticated());
  }
}
