import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/mini_player_cubit.dart';
import '../services/in_app_update_service.dart';
import '../utils/backend_config.dart';
import '../utils/force_update_helper.dart';

class ForceUpdateScreen extends StatefulWidget {
  static const String routeName = '/force-update';

  final ForceUpdateInfo? updateInfo;

  const ForceUpdateScreen({super.key, this.updateInfo});

  @override
  State<ForceUpdateScreen> createState() => _ForceUpdateScreenState();
}

class _ForceUpdateScreenState extends State<ForceUpdateScreen>
    with WidgetsBindingObserver {
  String? _detectedAbi;
  String _preferredApkPath = '/downloads/app-universal-release.apk';

  // In-app update state machine
  bool _isDownloading = false;
  bool _isInstalling = false;
  bool _needsInstallPermission = false;
  UpdateProgress? _downloadProgress;
  String? _downloadedApkPath;
  String? _errorMessage;

  final InAppUpdateService _updateService = InAppUpdateService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        context.read<MiniPlayerCubit>().dismiss();
      } catch (_) {}
    });
    _detectDeviceAbi();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (_isDownloading) {
      _updateService.cancelDownload();
    }
    ForceUpdateHelper.resetOnDispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _needsInstallPermission && _downloadedApkPath != null) {
      // User just returned from Android Settings screen — check if permission was granted
      _checkPermissionAndInstall(_downloadedApkPath!);
    }
  }

  Future<void> _detectDeviceAbi() async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      final abis = info.supportedAbis.map((e) => e.toLowerCase()).toList();
      String? matchedAbi;
      String path = '/downloads/app-universal-release.apk';

      if (abis.contains('x86_64')) {
        matchedAbi = 'x86_64';
        path = '/downloads/app-x86_64-release.apk';
      } else if (abis.contains('arm64-v8a')) {
        matchedAbi = 'arm64-v8a';
        path = '/downloads/app-release.apk';
      } else if (abis.contains('armeabi-v7a') || abis.contains('armeabi')) {
        matchedAbi = abis.contains('armeabi-v7a') ? 'armeabi-v7a' : 'armeabi';
        path = '/downloads/app-release-32bit.apk';
      }

      if (!mounted) return;
      setState(() {
        _detectedAbi = matchedAbi;
        _preferredApkPath = path;
      });
    } catch (e) {
      debugPrint('Failed to detect device ABI: $e');
    }
  }

  String _resolveUrl(String target) {
    final trimmed = target.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final baseUrl = BackendConfig.baseUrl.replaceAll(RegExp(r'/+$'), '');
    if (trimmed.startsWith('/')) {
      return '$baseUrl$trimmed';
    }
    return '$baseUrl/$trimmed';
  }

  String get _primaryDownloadTarget {
    final serverUrl = widget.updateInfo?.apkDownloadUrl?.trim();
    if (serverUrl != null &&
        serverUrl.isNotEmpty &&
        !serverUrl.endsWith('/downloads/app-release.apk')) {
      return serverUrl;
    }
    return _preferredApkPath;
  }

  String get _downloadPageTarget {
    final pageUrl = widget.updateInfo?.downloadPageUrl?.trim();
    if (pageUrl != null && pageUrl.isNotEmpty) {
      return pageUrl;
    }
    return '/download';
  }

  Future<void> _startInAppUpdate() async {
    if (_isDownloading) return;

    // If already downloaded and verified on disk, trigger installer directly
    if (_downloadedApkPath != null && File(_downloadedApkPath!).existsSync()) {
      await _checkPermissionAndInstall(_downloadedApkPath!);
      return;
    }

    setState(() {
      _isDownloading = true;
      _isInstalling = false;
      _errorMessage = null;
      _needsInstallPermission = false;
      _downloadProgress = const UpdateProgress(
        receivedBytes: 0,
        totalBytes: 0,
        percentage: 0.0,
        formattedProgress: 'Starting download...',
      );
    });

    final targetVersion = widget.updateInfo?.latestVersion ?? AppConstants.appVersion;
    final downloadUrl = _resolveUrl(_primaryDownloadTarget);
    final fileName = 'NivaTV_v${targetVersion}_${_detectedAbi ?? "universal"}.apk';

    try {
      final downloadedPath = await _updateService.downloadApk(
        downloadUrl: downloadUrl,
        fileName: fileName,
        onProgress: (progress) {
          if (!mounted) return;
          setState(() {
            _downloadProgress = progress;
          });
        },
      );

      if (!mounted) return;

      if (downloadedPath != null) {
        setState(() {
          _isDownloading = false;
          _downloadedApkPath = downloadedPath;
        });
        await _checkPermissionAndInstall(downloadedPath);
      } else {
        setState(() {
          _isDownloading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _errorMessage = 'Download interrupted: ${e.toString().replaceAll("Exception: ", "")}';
      });
    }
  }

  void _cancelDownload() {
    _updateService.cancelDownload();
    setState(() {
      _isDownloading = false;
      _downloadProgress = null;
    });
  }

  Future<void> _checkPermissionAndInstall(String filePath) async {
    final canInstall = await _updateService.canRequestPackageInstalls();
    if (!mounted) return;

    if (!canInstall) {
      setState(() {
        _needsInstallPermission = true;
        _isInstalling = false;
      });
      return;
    }

    setState(() {
      _needsInstallPermission = false;
      _isInstalling = true;
      _errorMessage = null;
    });

    final success = await _updateService.installApk(filePath);
    if (!mounted) return;

    if (!success) {
      setState(() {
        _isInstalling = false;
        _errorMessage = 'Could not launch package installer. Please grant install permission or use the browser download.';
      });
    } else {
      setState(() {
        _isInstalling = false;
      });
    }
  }

  Future<void> _openInstallPermissionSettings() async {
    final opened = await _updateService.openInstallSettings();
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enable "Install unknown apps" for NivaTV in device Settings'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _launchBrowserDownload(BuildContext context, String pathOrUrl) async {
    final url = _resolveUrl(pathOrUrl);
    final launched = await _updateService.launchBrowserFallback(url);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not open $url in browser'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text1 = AppColors.text1(context);
    final text2 = AppColors.text2(context);
    final bgColor = AppColors.bg(context);
    final targetVersion = widget.updateInfo?.latestVersion ?? AppConstants.appVersion;
    final subtitleMessage = widget.updateInfo?.message ??
        'A mandatory application update is required to continue streaming. Please update to the latest version to enjoy all live channels and subscription features.';

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: bgColor,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Glowing Icon Badge
                  Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          const Color(AppColors.primary).withOpacity(0.25),
                          const Color(AppColors.brandRed).withOpacity(0.18),
                        ],
                      ),
                      border: Border.all(
                        color: const Color(AppColors.primary).withOpacity(0.4),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(AppColors.primary).withOpacity(0.3),
                          blurRadius: 28,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        _isDownloading
                            ? Icons.downloading_rounded
                            : _downloadedApkPath != null
                                ? Icons.verified_rounded
                                : Icons.system_update_rounded,
                        size: 44,
                        color: _downloadedApkPath != null
                            ? const Color(0xFF10B981)
                            : const Color(AppColors.primaryLight),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),

                  // Version Tag
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(AppColors.primary).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(AppColors.primary).withOpacity(0.25),
                        width: 0.8,
                      ),
                    ),
                    child: const Text(
                      'MANDATORY UPDATE REQUIRED',
                      style: TextStyle(
                        color: Color(AppColors.primaryLight),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Heading
                  Text(
                    'Update to NivaTV v$targetVersion',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: text1,
                      fontSize: 23,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Subtitle
                  Text(
                    subtitleMessage,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: text2,
                      fontSize: 13.5,
                      height: 1.45,
                    ),
                  ),
                  if (_detectedAbi != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Detected device architecture: $_detectedAbi',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: text2.withOpacity(0.85),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),

                  // Changelog Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(AppColors.surfaceElevated).withOpacity(0.5)
                          : const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isDark
                            ? const Color(AppColors.divider)
                            : const Color(0xFFE2E8F0),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.auto_awesome_rounded,
                              size: 18,
                              color: Color(0xFF22D3EE),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              "What's New in v$targetVersion:",
                              style: TextStyle(
                                color: text1,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _buildBullet('Seamless in-app auto-download and 1-tap installation', text2),
                        const SizedBox(height: 7),
                        _buildBullet('Search filter isolation with dedicated SearchCubit', text2),
                        const SizedBox(height: 7),
                        _buildBullet('Channel deduplication across Home, Live TV & Search', text2),
                        const SizedBox(height: 7),
                        _buildBullet('Full Light & Dark theme token system across all screens', text2),
                        const SizedBox(height: 7),
                        _buildBullet('Low-latency stream buffering and zero-stutter playback', text2),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),

                  // Error Message Banner (if any)
                  if (_errorMessage != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(AppColors.error).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(AppColors.error).withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              color: Color(AppColors.error), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: Color(AppColors.error),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // ACTIVE STATE 1: Downloading in progress
                  if (_isDownloading) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: isDark
                            ? const Color(AppColors.surfaceElevated)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: const Color(AppColors.primary).withOpacity(0.3),
                        ),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Downloading v$targetVersion...',
                                style: TextStyle(
                                  color: text1,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                '${((_downloadProgress?.percentage ?? 0.0) * 100).toInt()}%',
                                style: const TextStyle(
                                  color: Color(AppColors.primaryLight),
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: LinearProgressIndicator(
                              value: _downloadProgress?.percentage,
                              minHeight: 8,
                              backgroundColor: isDark
                                  ? const Color(AppColors.divider)
                                  : const Color(0xFFCBD5E1),
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                Color(AppColors.primary),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _downloadProgress?.formattedProgress ?? 'Connecting...',
                                style: TextStyle(
                                  color: text2,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              GestureDetector(
                                onTap: _cancelDownload,
                                child: const Text(
                                  'Cancel',
                                  style: TextStyle(
                                    color: Color(AppColors.error),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ]
                  // ACTIVE STATE 2: Needs Android unknown sources permission
                  else if (_needsInstallPermission) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFFF59E0B).withOpacity(0.35),
                        ),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.security_rounded,
                                  color: Color(0xFFF59E0B), size: 22),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Installation Permission Needed',
                                  style: TextStyle(
                                    color: Color(0xFFF59E0B),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Android requires you to allow NivaTV to install updates. Tap below to enable "Install unknown apps", then return to finish updating.',
                            style: TextStyle(
                              color: text1,
                              fontSize: 12.5,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            height: 46,
                            child: ElevatedButton.icon(
                              onPressed: _openInstallPermissionSettings,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFF59E0B),
                                foregroundColor: Colors.black,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              icon: const Icon(Icons.settings_suggest_rounded, size: 20),
                              label: const Text(
                                'Open Settings & Allow',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_downloadedApkPath != null)
                      SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: OutlinedButton.icon(
                          onPressed: () => _checkPermissionAndInstall(_downloadedApkPath!),
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          icon: const Icon(Icons.install_mobile_rounded, size: 18),
                          label: const Text('Try Installing Now'),
                        ),
                      ),
                  ]
                  // ACTIVE STATE 3: APK downloaded and ready to install
                  else if (_downloadedApkPath != null && !_isInstalling) ...[
                    Container(
                      width: double.infinity,
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF10B981), Color(0xFF059669)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF10B981).withOpacity(0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => _checkPermissionAndInstall(_downloadedApkPath!),
                          borderRadius: BorderRadius.circular(16),
                          child: const Center(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.install_mobile_rounded, color: Colors.white, size: 22),
                                SizedBox(width: 8),
                                Text(
                                  'Install Update Now',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextButton.icon(
                      onPressed: _startInAppUpdate,
                      icon: const Icon(Icons.refresh_rounded, size: 16),
                      label: const Text('Redownload APK'),
                    ),
                  ]
                  // DEFAULT STATE: Ready to start In-App Download
                  else ...[
                    Container(
                      width: double.infinity,
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF4F46E5).withOpacity(0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: _startInAppUpdate,
                          borderRadius: BorderRadius.circular(16),
                          child: const Center(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.download_rounded, color: Colors.white, size: 21),
                                SizedBox(width: 8),
                                Text(
                                  'Update Now (In-App)',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 14),

                  // Secondary Option: Browser Download Fallback
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: OutlinedButton.icon(
                      onPressed: () => _launchBrowserDownload(context, _primaryDownloadTarget),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: isDark
                              ? const Color(AppColors.divider)
                              : const Color(0xFFCBD5E1),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: Icon(
                        Icons.open_in_browser_rounded,
                        size: 18,
                        color: text1,
                      ),
                      label: Text(
                        'Download via Browser (Alternative)',
                        style: TextStyle(
                          color: text1,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Universal APK Download link
                  TextButton.icon(
                    onPressed: () => _launchBrowserDownload(
                        context, '/downloads/app-universal-release.apk'),
                    icon: Icon(
                      Icons.android_rounded,
                      size: 16,
                      color: isDark ? const Color(AppColors.primaryLight) : const Color(AppColors.primary),
                    ),
                    label: Text(
                      'Universal APK (For Android TV / FireStick)',
                      style: TextStyle(
                        color: isDark ? const Color(AppColors.primaryLight) : const Color(AppColors.primary),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),

                  // Official Download Portal link
                  TextButton.icon(
                    onPressed: () => _launchBrowserDownload(context, _downloadPageTarget),
                    icon: Icon(
                      Icons.open_in_browser_rounded,
                      size: 16,
                      color: isDark ? const Color(AppColors.primaryLight) : const Color(AppColors.primary),
                    ),
                    label: Text(
                      'Open Official Web Download Page',
                      style: TextStyle(
                        color: isDark ? const Color(AppColors.primaryLight) : const Color(AppColors.primary),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBullet(String text, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 6),
          width: 5,
          height: 5,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(AppColors.brandRed),
          ),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
