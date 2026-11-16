import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Service to manage Android window backlight brightness during video playback.
/// Respects the user's natural system auto-brightness / display setting to prevent
/// severe battery drain, display heating, and thermal throttling.
class ScreenBrightnessService {
  static const MethodChannel _channel = MethodChannel('com.iptv.iptv_app/screen');
  static bool _isBoosted = false;

  /// Keeps device brightness at the user's system level.
  /// Intentionally avoids forcing 100% full backlight which caused heavy device overheating and thermal throttling.
  static Future<void> boostBrightness({double brightness = 1.0}) async {
    // Intentionally no-op to protect phone battery and keep phone cool.
    return;
  }

  /// Restores the phone's system-default / automatic brightness
  static Future<void> resetBrightness() async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('resetScreenBrightness');
      _isBoosted = false;
    } catch (e) {
      debugPrint('[ScreenBrightnessService] reset failed: $e');
    }
  }
}
