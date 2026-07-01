import 'dart:convert';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../models/user_model.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.token, token);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(StorageKeys.token);
  }

  // Fix #24: Use real hardware device ID for stable cross-reinstall tracking
  Future<String> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    String? deviceId = prefs.getString(StorageKeys.deviceId);
    if (deviceId == null || deviceId.isEmpty) {
      deviceId = await _readHardwareDeviceId();
      await prefs.setString(StorageKeys.deviceId, deviceId);
    }
    return deviceId;
  }

  Future<String> _readHardwareDeviceId() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (!kIsWeb && Platform.isAndroid) {
        final info = await deviceInfo.androidInfo;
        // Use Android ID — persists across reinstalls unless factory reset
        return info.id.isNotEmpty ? info.id : _fallbackDeviceId();
      } else if (!kIsWeb && Platform.isIOS) {
        final info = await deviceInfo.iosInfo;
        return info.identifierForVendor ?? _fallbackDeviceId();
      }
    } catch (_) {
      // Fall through to timestamp-based fallback
    }
    return _fallbackDeviceId();
  }

  String _fallbackDeviceId() {
    return 'dev_${DateTime.now().millisecondsSinceEpoch}';
  }

  Future<void> saveUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(StorageKeys.user, jsonEncode(user.toJson()));
  }

  Future<UserModel?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(StorageKeys.user);
    if (data == null) return null;
    try {
      return UserModel.fromJson(jsonDecode(data));
    } catch (e) {
      return null;
    }
  }

  Future<void> setFirstLaunchComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(StorageKeys.isFirstLaunch, false);
    await prefs.setBool(StorageKeys.hasSeenOnboarding, true);
  }

  Future<bool> isFirstLaunch() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(StorageKeys.isFirstLaunch) ?? true;
  }

  Future<bool> hasSeenOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(StorageKeys.hasSeenOnboarding) ?? false;
  }

  // --- Playback Settings ---
  Future<void> setVideoFitMode(String mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('video_fit_mode', mode);
  }

  Future<String> getVideoFitMode() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('video_fit_mode') ?? 'original';
  }

  Future<void> setChannelFitMode(int channelId, String mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('video_fit_mode_$channelId', mode);
  }

  Future<String?> getChannelFitMode(int channelId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('video_fit_mode_$channelId');
  }

  Future<void> removeChannelFitMode(int channelId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('video_fit_mode_$channelId');
  }

  Future<bool> hasChannelFitMode(int channelId) async {
    return (await getChannelFitMode(channelId)) != null;
  }

  Future<void> setVideoQualityPreference(String quality) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('video_quality_preference', quality);
  }

  Future<String> getVideoQualityPreference() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('video_quality_preference') ?? 'auto';
  }

  Future<void> setDataSaverEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('data_saver_enabled', enabled);
  }

  Future<bool> isDataSaverEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('data_saver_enabled') ?? false;
  }

  Future<void> setAutoQualityOnMobileData(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('auto_quality_mobile', enabled);
  }

  Future<bool> isAutoQualityOnMobileData() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('auto_quality_mobile') ?? true;
  }

  Future<void> setHdOnlyOnWifi(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('hd_only_wifi', enabled);
  }

  Future<bool> isHdOnlyOnWifi() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('hd_only_wifi') ?? true;
  }

  /// Clears only auth credentials (token + user data + cached content).
  /// Does NOT touch onboarding flags, device ID, or app settings so the user
  /// doesn't have to redo onboarding or re-pair their device on next login.
  /// Use this for session expiry / invalid token cases.
  Future<void> clearAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.token);
    await prefs.remove(StorageKeys.user);
    await prefs.remove(StorageKeys.cachedChannels);
    await prefs.remove(StorageKeys.cachedCategories);
  }

  /// Full wipe — only call this on explicit user-initiated "Sign Out".
  /// Clears everything including onboarding and device ID.
  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(StorageKeys.token);
    await prefs.remove(StorageKeys.user);
    await prefs.remove(StorageKeys.deviceId);
    await prefs.remove(StorageKeys.isFirstLaunch);
    await prefs.remove(StorageKeys.hasSeenOnboarding);
    await prefs.remove(StorageKeys.cachedChannels);
    await prefs.remove(StorageKeys.cachedCategories);
  }
}
