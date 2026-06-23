import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';

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

class AuthCubit extends Cubit<AuthState> {
  AuthCubit() : super(AuthInitial());

  final AuthService _authService = AuthService();
  final StorageService _storage = StorageService();

  Future<void> login(String email, String password, {String? deviceId, String? deviceName}) async {
    emit(AuthLoading());
    try {
      final result = await _authService.login(
        email: email,
        password: password,
        deviceId: deviceId ?? UniqueKey().toString(),
        deviceName: deviceName,
      );
      if (result != null) {
        await _storage.saveToken(result.token);
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Login failed'));
      }
    } catch (e) {
      emit(AuthError(e.toString()));
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
        emit(AuthAuthenticated());
      } else {
        emit(AuthError('Signup failed'));
      }
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }

  Future<void> checkAuth() async {
    final token = await _storage.getToken();
    if (token != null) {
      _authService.setToken(token);
      emit(AuthAuthenticated());
    } else {
      emit(AuthUnauthenticated());
    }
  }

  Future<void> logout() async {
    await _authService.clearSession();
    await _storage.clearAll();
    emit(AuthUnauthenticated());
  }
}
