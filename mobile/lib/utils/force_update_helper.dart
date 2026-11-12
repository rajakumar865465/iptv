import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../constants.dart';
import '../main.dart';
import '../screens/force_update_screen.dart';

class ForceUpdateInfo {
  final String? latestVersion;
  final String? minimumVersion;
  final String? apkDownloadUrl;
  final String? downloadPageUrl;
  final String? message;

  const ForceUpdateInfo({
    this.latestVersion,
    this.minimumVersion,
    this.apkDownloadUrl,
    this.downloadPageUrl,
    this.message,
  });

  static String? _clean(dynamic value) {
    final s = value?.toString().trim();
    if (s == null || s.isEmpty || s == 'null') return null;
    return s;
  }

  static String? _pick(String? preferred, String? fallback) {
    final p = _clean(preferred);
    return p ?? _clean(fallback);
  }

  ForceUpdateInfo merge(ForceUpdateInfo? other) {
    if (other == null) return this;
    return ForceUpdateInfo(
      latestVersion: _pick(other.latestVersion, latestVersion),
      minimumVersion: _pick(other.minimumVersion, minimumVersion),
      apkDownloadUrl: _pick(other.apkDownloadUrl, apkDownloadUrl),
      downloadPageUrl: _pick(other.downloadPageUrl, downloadPageUrl),
      message: _pick(other.message, message),
    );
  }

  factory ForceUpdateInfo.fromConfig(Map<String, dynamic> config) {
    final minVer = _clean(config['minimum_app_version']);
    final latestVer = _clean(config['latest_app_version']) ?? minVer;
    return ForceUpdateInfo(
      latestVersion: latestVer,
      minimumVersion: minVer,
      apkDownloadUrl: _clean(config['apk_download_url']),
      downloadPageUrl: '/download',
    );
  }

  static ForceUpdateInfo? fromResponseMap(Map<String, dynamic>? map) {
    if (map == null) return null;
    final rawData = map['data'];
    Map<String, dynamic>? dataMap;
    if (rawData is Map) {
      dataMap = Map<String, dynamic>.from(rawData);
    }
    return ForceUpdateInfo(
      latestVersion: _clean(dataMap?['latest_version'] ?? map['latest_version']),
      minimumVersion: _clean(dataMap?['minimum_version'] ?? map['minimum_version']),
      apkDownloadUrl: _clean(dataMap?['apk_download_url'] ?? map['apk_download_url']),
      downloadPageUrl: _clean(dataMap?['download_page_url'] ?? map['download_page_url']),
      message: _clean(map['message']),
    );
  }
}

class ForceUpdateHelper {
  static bool _isNavigating = false;
  static bool _isActive = false;
  static ForceUpdateInfo? _latestInfo;

  static bool get isActive => _isActive || _isNavigating;
  static ForceUpdateInfo? get latestInfo => _latestInfo;

  static Map<String, String> get appHeaders => {
        'Content-Type': 'application/json',
        'X-App-Version': AppConstants.appVersion,
        if (!kIsWeb)
          'User-Agent': 'NivaTV/${AppConstants.appVersion} (Android; Dart/3.13)',
      };

  static void applyAppHeaders(Map<String, dynamic> headers) {
    headers['X-App-Version'] = AppConstants.appVersion;
    if (!kIsWeb) {
      headers['User-Agent'] =
          'NivaTV/${AppConstants.appVersion} (Android; Dart/3.13)';
    }
  }

  static bool isVersionBelow(String current, String target) {
    try {
      final cParts = current
          .split('.')
          .map((s) => int.tryParse(s.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0)
          .toList();
      final tParts = target
          .split('.')
          .map((s) => int.tryParse(s.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0)
          .toList();
      final maxLen = cParts.length > tParts.length ? cParts.length : tParts.length;
      for (int i = 0; i < maxLen; i++) {
        final c = i < cParts.length ? cParts[i] : 0;
        final t = i < tParts.length ? tParts[i] : 0;
        if (c < t) return true;
        if (c > t) return false;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  static Map<String, dynamic>? _parseResponseData(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is String && raw.trim().startsWith('{')) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }
    return null;
  }

  static bool isForceUpdateException(Object? error) {
    if (error is! DioException) return false;
    if (error.response?.statusCode == 426) return true;
    final data = _parseResponseData(error.response?.data);
    if (data != null && data['error']?.toString() == 'FORCE_UPDATE_REQUIRED') {
      return true;
    }
    return false;
  }

  static ForceUpdateInfo? extractInfo(Object? error) {
    if (error is! DioException) return null;
    final data = _parseResponseData(error.response?.data);
    return ForceUpdateInfo.fromResponseMap(data);
  }

  static void handleDioError(DioException error) {
    if (!isForceUpdateException(error)) return;
    navigateToForceUpdate(info: extractInfo(error));
  }

  static void resetOnDispose() {
    _isActive = false;
    _isNavigating = false;
  }

  static void navigateToForceUpdate({
    ForceUpdateInfo? info,
    NavigatorState? navigator,
  }) {
    if (info != null) {
      _latestInfo = _latestInfo == null ? info : _latestInfo!.merge(info);
    }

    if (_isActive || _isNavigating) return;
    _isNavigating = true;

    void pushScreen() {
      final nav = appNavigatorKey.currentState ??
          (navigator != null && navigator.mounted ? navigator : null);
      if (nav == null) {
        _isNavigating = false;
        return;
      }
      _isActive = true;
      _isNavigating = false;
      nav.pushAndRemoveUntil(
        MaterialPageRoute(
          settings: const RouteSettings(name: ForceUpdateScreen.routeName),
          builder: (_) => ForceUpdateScreen(updateInfo: _latestInfo),
        ),
        (route) => false,
      );
    }

    if (SchedulerBinding.instance.schedulerPhase ==
        SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) => pushScreen());
      WidgetsBinding.instance.ensureVisualUpdate();
    } else {
      pushScreen();
    }
  }
}
