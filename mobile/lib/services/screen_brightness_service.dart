import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Service to control Android hardware window backlight brightness during video playback.
/// Overrides auto-dimming / power-saving screen dimming while watching channels,
/// and restores the user's OS-level brightness upon exiting or minimizing to PiP.
class ScreenBrightnessService {
  static const MethodChannel _channel = MethodChannel('com.iptv.iptv_app/screen');
  static bool _isBoosted = false;

  /// Boosts the device screen backlight for cinema/video viewing (default 1.0 = 100%)
  static Future<void> boostBrightness({double brightness = 1.0}) async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('setScreenBrightness', {
        'brightness': brightness.clamp(0.1, 1.0),
      });
      _isBoosted = true;
    } catch (e) {
      debugPrint('[ScreenBrightnessService] boost failed: $e');
    }
  }

  /// Restores the phone's system-default / automatic brightness
  static Future<void> resetBrightness() async {
    if (kIsWeb || !Platform.isAndroid || !_isBoosted) return;
    try {
      await _channel.invokeMethod('resetScreenBrightness');
      _isBoosted = false;
    } catch (e) {
      debugPrint('[ScreenBrightnessService] reset failed: $e');
    }
  }
}
