import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../utils/force_update_helper.dart';

class UpdateProgress {
  final int receivedBytes;
  final int totalBytes;
  final double percentage; // 0.0 to 1.0
  final String formattedProgress;

  const UpdateProgress({
    required this.receivedBytes,
    required this.totalBytes,
    required this.percentage,
    required this.formattedProgress,
  });

  static String formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    double d = bytes.toDouble();
    while (d >= 1024 && i < suffixes.length - 1) {
      d /= 1024;
      i++;
    }
    return '${d.toStringAsFixed(1)} ${suffixes[i]}';
  }
}

class InAppUpdateService {
  static const MethodChannel _channel = MethodChannel('com.iptv.iptv_app/updater');
  static final InAppUpdateService _instance = InAppUpdateService._internal();

  factory InAppUpdateService() => _instance;
  InAppUpdateService._internal();

  CancelToken? _cancelToken;
  bool _isDownloading = false;

  bool get isDownloading => _isDownloading;

  /// Check if the app currently has permission to install packages (Android 8.0+)
  Future<bool> canRequestPackageInstalls() async {
    if (kIsWeb || !Platform.isAndroid) return true;
    try {
      final bool? allowed = await _channel.invokeMethod<bool>('canRequestPackageInstalls');
      return allowed ?? true;
    } on PlatformException catch (e) {
      debugPrint('[InAppUpdateService] canRequestPackageInstalls error: $e');
      return true;
    }
  }

  /// Open Android system settings to grant "Install unknown apps" permission for NivaTV
  Future<bool> openInstallSettings() async {
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final bool? opened = await _channel.invokeMethod<bool>('openInstallSettings');
      return opened ?? false;
    } on PlatformException catch (e) {
      debugPrint('[InAppUpdateService] openInstallSettings error: $e');
      return false;
    }
  }

  /// Request the native system package installer to install the downloaded APK
  Future<bool> installApk(String filePath) async {
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final bool? success = await _channel.invokeMethod<bool>('installApk', {
        'filePath': filePath,
      });
      return success ?? false;
    } on PlatformException catch (e) {
      debugPrint('[InAppUpdateService] installApk error: $e');
      return false;
    }
  }

  /// Query Android cache directory for storing update APK
  Future<String?> getUpdateCacheDirectory() async {
    if (kIsWeb || !Platform.isAndroid) return null;
    try {
      final String? dir = await _channel.invokeMethod<String>('getAppCacheDirectory');
      return dir;
    } on PlatformException catch (e) {
      debugPrint('[InAppUpdateService] getAppCacheDirectory error: $e');
      return null;
    }
  }

  /// Cancel any ongoing download
  void cancelDownload() {
    if (_isDownloading && _cancelToken != null && !_cancelToken!.isCancelled) {
      _cancelToken!.cancel('User cancelled download');
    }
    _isDownloading = false;
  }

  /// Download the APK with progress reporting
  Future<String?> downloadApk({
    required String downloadUrl,
    required String fileName,
    required void Function(UpdateProgress progress) onProgress,
  }) async {
    if (_isDownloading) return null;
    _isDownloading = true;
    _cancelToken = CancelToken();

    try {
      final cacheDir = await getUpdateCacheDirectory();
      if (cacheDir == null) {
        throw Exception('Could not determine local cache directory for APK download.');
      }

      final targetDir = Directory(cacheDir);
      if (!await targetDir.exists()) {
        await targetDir.create(recursive: true);
      }

      // Clean up previous APK files to avoid storage clutter
      try {
        final existingFiles = targetDir.listSync();
        for (final file in existingFiles) {
          if (file is File && (file.path.endsWith('.apk') || file.path.endsWith('.tmp'))) {
            try { file.deleteSync(); } catch (_) {}
          }
        }
      } catch (_) {}

      final sanitizedName = fileName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
      final tempFilePath = '$cacheDir/$sanitizedName.tmp';
      final finalFilePath = '$cacheDir/$sanitizedName';

      final tempFile = File(tempFilePath);
      if (await tempFile.exists()) {
        await tempFile.delete();
      }

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(minutes: 10),
        headers: ForceUpdateHelper.appHeaders,
        followRedirects: true,
      ));

      debugPrint('[InAppUpdateService] Starting APK download from: $downloadUrl');
      debugPrint('[InAppUpdateService] Saving to temp file: $tempFilePath');

      await dio.download(
        downloadUrl,
        tempFilePath,
        cancelToken: _cancelToken,
        deleteOnError: true,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            final percent = (received / total).clamp(0.0, 1.0);
            final formatted = '${UpdateProgress.formatBytes(received)} / ${UpdateProgress.formatBytes(total)}';
            onProgress(UpdateProgress(
              receivedBytes: received,
              totalBytes: total,
              percentage: percent,
              formattedProgress: formatted,
            ));
          } else {
            // Unknown total length
            final formatted = UpdateProgress.formatBytes(received);
            onProgress(UpdateProgress(
              receivedBytes: received,
              totalBytes: 0,
              percentage: 0.5,
              formattedProgress: formatted,
            ));
          }
        },
      );

      // Rename temp file to final .apk file
      final downloadedTempFile = File(tempFilePath);
      if (!await downloadedTempFile.exists() || await downloadedTempFile.length() == 0) {
        throw Exception('Downloaded file is missing or empty.');
      }

      final finalFile = await downloadedTempFile.rename(finalFilePath);
      debugPrint('[InAppUpdateService] Download finished: ${finalFile.path} (${await finalFile.length()} bytes)');
      _isDownloading = false;
      return finalFile.path;
    } catch (e) {
      _isDownloading = false;
      if (e is DioException && CancelToken.isCancel(e)) {
        debugPrint('[InAppUpdateService] Download cancelled by user');
        return null;
      }
      debugPrint('[InAppUpdateService] Download failed: $e');
      rethrow;
    }
  }

  /// Launch external browser fallback if native update fails
  Future<bool> launchBrowserFallback(String url) async {
    try {
      final uri = Uri.parse(url);
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('[InAppUpdateService] Browser fallback failed: $e');
      return false;
    }
  }
}
