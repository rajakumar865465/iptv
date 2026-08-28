import 'package:google_sign_in/google_sign_in.dart';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/user_model.dart';
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
  final bool isGoogleLogin;
  AuthDeviceLimitReached(this.email, this.password, this.message, {this.isGoogleLogin = false});
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
        if (result.user != null) {
          await _storage.saveUser(result.user!);
        }
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Login failed'));
      }
    } catch (e) {
      if (e is DioException) {
        final statusCode = e.response?.statusCode;
        // On Flutter web, Dio returns error response bodies as raw String instead of
        // a parsed Map. Parse manually so DEVICE_LIMIT_REACHED is always detected.
        var raw = e.response?.data;
        Map<String, dynamic>? data;
        if (raw is Map<String, dynamic>) {
          data = raw;
        } else if (raw is String) {
          try { data = jsonDecode(raw) as Map<String, dynamic>?; } catch (_) {}
        }
        String message = 'Login failed. Please check your credentials.';

        if (data != null && data['message'] != null) {
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

  
  Future<void> loginWithGoogle({String? deviceId, String? deviceName, bool forceLogoutOldest = false}) async {
    emit(AuthLoading());
    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn.instance.authenticate();
      if (googleUser == null) {
        emit(AuthInitial());
        return;
      }

      final GoogleSignInAuthentication auth = await googleUser.authentication;
      final String? idToken = auth.idToken;

      if (idToken == null || idToken.isEmpty) {
        throw Exception('Failed to get Google authentication token. Please try again.');
      }

      final actualDeviceId = deviceId ?? await _storage.getDeviceId();
      final result = await _authService.googleLogin(
        idToken: idToken,
        deviceId: actualDeviceId,
        deviceName: deviceName,
        forceLogoutOldest: forceLogoutOldest,
      );
      
      if (result != null) {
        await _storage.saveToken(result.token);
        if (result.refreshToken != null && result.refreshToken!.isNotEmpty) {
          await _storage.saveRefreshToken(result.refreshToken!);
        }
        if (result.user != null) {
          await _storage.saveUser(result.user!);
        }
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Google Sign-In failed'));
      }
    } catch (e) {
      final errorStr = e.toString().toLowerCase();
      if (errorStr.contains('device_limit_reached')) {
        emit(AuthDeviceLimitReached('', '', e.toString(), isGoogleLogin: true));
      } else if (errorStr.contains('canceled') || errorStr.contains('cancelled') || errorStr.contains('sign_in_canceled') || errorStr.contains('user_cancelled')) {
        emit(AuthInitial());
      } else {
        emit(AuthError(e.toString().replaceAll('Exception: ', '')));
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
        if (result.user != null) {
          await _storage.saveUser(result.user!);
        }
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Signup failed'));
      }
    } catch (e) {
      if (e is DioException) {
        final statusCode = e.response?.statusCode;
        var rawS = e.response?.data;
        Map<String, dynamic>? data;
        if (rawS is Map<String, dynamic>) {
          data = rawS;
        } else if (rawS is String) {
          try { data = jsonDecode(rawS) as Map<String, dynamic>?; } catch (_) {}
        }
        String message = 'Signup failed. Please try again.';
        if (data != null && data['message'] != null) {
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
          try {
            final user = UserModel.fromJson(meResult);
            await _storage.saveUser(user);
          } catch (_) {}
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
  ///
  /// IMPORTANT: After TokenRefreshService saves the new token to SharedPreferences,
  /// we must also update _authService._token in-memory, because AuthService.me()
  /// uses its own Dio instance with an in-memory token (not SharedPreferences).
  /// Without this, the retry /me call after refresh would still send the old
  /// expired token and force the user to re-login every time the token ages past 15m.
  Future<bool> tryRefresh() async {
    final success = await TokenRefreshService.instance.refresh();
    if (success) {
      final newToken = await _storage.getToken();
      if (newToken != null) _authService.setToken(newToken);
    }
    return success;
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
