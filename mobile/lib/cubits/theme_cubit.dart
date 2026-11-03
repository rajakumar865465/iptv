import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/storage_service.dart';

/// Cubit managing app-wide [ThemeMode] (dark, light, or system).
class ThemeCubit extends Cubit<ThemeMode> {
  final StorageService _storage = StorageService();

  ThemeCubit() : super(ThemeMode.dark) {
    loadTheme();
  }

  Future<void> loadTheme() async {
    try {
      final saved = await _storage.getThemeMode();
      switch (saved) {
        case 'light':
          emit(ThemeMode.light);
          break;
        case 'system':
          emit(ThemeMode.system);
          break;
        case 'dark':
        default:
          emit(ThemeMode.dark);
          break;
      }
    } catch (_) {
      emit(ThemeMode.dark);
    }
  }

  Future<void> setTheme(ThemeMode mode) async {
    emit(mode);
    String modeStr;
    switch (mode) {
      case ThemeMode.light:
        modeStr = 'light';
        break;
      case ThemeMode.system:
        modeStr = 'system';
        break;
      case ThemeMode.dark:
        modeStr = 'dark';
        break;
    }
    await _storage.saveThemeMode(modeStr);
  }

  bool get isLight => state == ThemeMode.light;
  bool get isDark => state == ThemeMode.dark;
  bool get isSystem => state == ThemeMode.system;
}
