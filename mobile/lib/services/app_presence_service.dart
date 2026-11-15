import 'dart:async';
import 'package:flutter/widgets.dart';
import 'api_service.dart';

/// Periodically reports the user's presence/active state to the backend
/// while the app is in the foreground, allowing the admin dashboard
/// to track both live stream watchers and in-app browsing users.
class AppPresenceService with WidgetsBindingObserver {
  static final AppPresenceService _instance = AppPresenceService._internal();
  factory AppPresenceService() => _instance;
  AppPresenceService._internal();

  final ApiService _api = ApiService();
  Timer? _heartbeatTimer;
  String _currentScreen = 'Home';
  bool _isForeground = true;
  bool _initialized = false;

  void initialize() {
    if (_initialized) return;
    _initialized = true;
    WidgetsBinding.instance.addObserver(this);
    start();
  }

  void setScreen(String screen) {
    if (_currentScreen == screen) return;
    _currentScreen = screen;
    // Immediately report screen transition if in foreground
    if (_isForeground) {
      _api.sendAppHeartbeat(screen: _currentScreen);
    }
  }

  void start() {
    _heartbeatTimer?.cancel();
    // Send immediate ping
    _api.sendAppHeartbeat(screen: _currentScreen);
    // Periodic ping every 30 seconds
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_isForeground) {
        _api.sendAppHeartbeat(screen: _currentScreen);
      }
    });
  }

  void stop() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _isForeground = true;
      _api.sendAppHeartbeat(screen: _currentScreen);
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      _isForeground = false;
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    stop();
  }
}
