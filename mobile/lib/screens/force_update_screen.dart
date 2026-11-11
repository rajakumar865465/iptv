import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants.dart';
import '../utils/backend_config.dart';

class ForceUpdateScreen extends StatelessWidget {
  const ForceUpdateScreen({super.key});

  Future<void> _launchDownload(BuildContext context, String path) async {
    final baseUrl = BackendConfig.baseUrl;
    final url = '$baseUrl$path';
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
                  'Update to NivaTV v${AppConstants.appVersion}',
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
                  'A mandatory application update is required to continue streaming. Please update to the latest version to enjoy all live channels and subscription features.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: text2,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 28),

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
                            "What's New in v${AppConstants.appVersion}:",
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
                const SizedBox(height: 32),

                // Primary CTA: Download APK
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
                      onTap: () => _launchDownload(context, '/downloads/app-release.apk'),
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
                const SizedBox(height: 14),

                // Secondary CTA: Visit Download Portal
                TextButton.icon(
                  onPressed: () => _launchDownload(context, '/download'),
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
