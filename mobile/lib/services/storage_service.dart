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

  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    // Fix #21: Also clear cached channels/categories so a new user doesn't see
    // the previous user's cached channel list after logout.
    await prefs.remove(StorageKeys.token);
    await prefs.remove(StorageKeys.user);
    await prefs.remove(StorageKeys.deviceId);
    await prefs.remove(StorageKeys.isFirstLaunch);
    await prefs.remove(StorageKeys.hasSeenOnboarding);
    await prefs.remove(StorageKeys.cachedChannels);
    await prefs.remove(StorageKeys.cachedCategories);
  }
}
