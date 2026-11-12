import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants.dart';
import '../cubits/mini_player_cubit.dart';
import '../utils/backend_config.dart';
import '../utils/force_update_helper.dart';

class ForceUpdateScreen extends StatefulWidget {
  static const String routeName = '/force-update';

  final ForceUpdateInfo? updateInfo;

  const ForceUpdateScreen({super.key, this.updateInfo});

  @override
  State<ForceUpdateScreen> createState() => _ForceUpdateScreenState();
}

class _ForceUpdateScreenState extends State<ForceUpdateScreen> {
  String? _detectedAbi;
  String _preferredApkPath = '/downloads/app-universal-release.apk';

  @override
  void initState() {
    super.initState();
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
    ForceUpdateHelper.resetOnDispose();
    super.dispose();
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

  Future<void> _launchDownload(BuildContext context, String pathOrUrl) async {
    final url = _resolveUrl(pathOrUrl);
    try {
      final uri = Uri.parse(url);
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Please open $url in your browser'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error launching update url: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open $url'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
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
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Glowing Icon Badge
                Container(
                  width: 96,
                  height: 96,
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
                        blurRadius: 30,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.system_update_rounded,
                      size: 46,
                      color: Color(AppColors.primaryLight),
                    ),
                  ),
                ),
                const SizedBox(height: 28),

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
                    'NEW UPDATE REQUIRED',
                    style: TextStyle(
                      color: Color(AppColors.primaryLight),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Heading
                Text(
                  'Update to NivaTV v$targetVersion',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: text1,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 12),

                // Subtitle
                Text(
                  subtitleMessage,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: text2,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
                if (_detectedAbi != null) ...[
                  const SizedBox(height: 10),
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
                const SizedBox(height: 24),

                // Changelog Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(AppColors.surfaceElevated).withOpacity(0.5)
                        : const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(20),
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
                      const SizedBox(height: 12),
                      _buildBullet('Search filter isolation with dedicated SearchCubit', text2),
                      const SizedBox(height: 8),
                      _buildBullet('Channel deduplication across Home, Live TV & Search', text2),
                      const SizedBox(height: 8),
                      _buildBullet('Full Light & Dark theme token system across all screens', text2),
                      const SizedBox(height: 8),
                      _buildBullet('Low-latency stream buffering and zero-stutter playback', text2),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // Primary CTA: Download ABI-matched APK
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
                      onTap: () => _launchDownload(context, _primaryDownloadTarget),
                      borderRadius: BorderRadius.circular(16),
                      child: const Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.download_rounded, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Download & Update Now',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 15.5,
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
                const SizedBox(height: 12),

                // Secondary CTA: Universal APK Fallback
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        _launchDownload(context, '/downloads/app-universal-release.apk'),
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
                      Icons.android_rounded,
                      size: 18,
                      color: text1,
                    ),
                    label: Text(
                      'Download Universal APK (All Devices)',
                      style: TextStyle(
                        color: text1,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Tertiary CTA: Visit Download Portal
                TextButton.icon(
                  onPressed: () => _launchDownload(context, _downloadPageTarget),
                  icon: Icon(
                    Icons.open_in_browser_rounded,
                    size: 16,
                    color: isDark ? const Color(AppColors.primaryLight) : const Color(AppColors.primary),
                  ),
                  label: Text(
                    'Open Official Download Page',
                    style: TextStyle(
                      color: isDark ? const Color(AppColors.primaryLight) : const Color(AppColors.primary),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
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

  Widget _buildBullet(String text, Color textColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 6),
          width: 5,
          height: 5,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(AppColors.primaryLight),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: textColor,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
