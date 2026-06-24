import 'dart:convert';
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

  Future<String> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    String? deviceId = prefs.getString(StorageKeys.deviceId);
    if (deviceId == null) {
      deviceId = 'dev_${DateTime.now().millisecondsSinceEpoch}';
      await prefs.setString(StorageKeys.deviceId, deviceId);
    }
    return deviceId;
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
    // Only clear auth-related keys — preserve backend URL settings
    await prefs.remove(StorageKeys.token);
    await prefs.remove(StorageKeys.user);
    await prefs.remove(StorageKeys.deviceId);
    await prefs.remove(StorageKeys.isFirstLaunch);
    await prefs.remove(StorageKeys.hasSeenOnboarding);
  }
}
