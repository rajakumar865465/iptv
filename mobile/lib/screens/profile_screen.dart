import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants.dart';
import '../cubits/app_config_cubit.dart';
import '../cubits/auth_cubit.dart';
import '../cubits/license_cubit.dart';
import '../cubits/theme_cubit.dart';
import '../models/license_model.dart';
import '../models/user_model.dart';
import '../services/storage_service.dart';
import '../widgets/profile/edit_profile_sheet.dart';
import '../widgets/profile/license_status_card.dart';
import '../widgets/profile/profile_header_card.dart';
import '../widgets/profile/profile_menu_tile.dart';
import '../widgets/settings/theme_selector_sheet.dart';
import 'login_screen.dart';
import 'license_status_screen.dart';
import 'license_activation_screen.dart';
import 'playback_settings_screen.dart';
import 'report_problem_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  UserModel? _user;
  String _defaultQuality = 'Auto';
  bool _dataSaverEnabled = false;

  @override
  void initState() {
    super.initState();
    context.read<LicenseCubit>().checkStatus();
    _loadUser();
    _loadPlaybackSettings();
  }

  Future<void> _loadUser() async {
    final user = await StorageService().getUser();
    if (mounted) setState(() => _user = user);
  }

  Future<void> _loadPlaybackSettings() async {
    final storage = StorageService();
    final quality = await storage.getVideoQualityPreference();
    final dataSaver = await storage.isDataSaverEnabled();
    if (mounted) {
      setState(() {
        _defaultQuality = _formatQuality(quality);
        _dataSaverEnabled = dataSaver;
      });
    }
  }

  String _formatQuality(String quality) {
    switch (quality) {
      case 'auto':
        return 'Auto - Recommended';
      case 'data_saver':
        return 'Data Saver';
      case '1080p':
        return '1080p Full HD';
      case '720p':
        return '720p HD';
      case '480p':
        return '480p Standard';
      case '360p':
        return '360p Medium';
      case '240p':
        return '240p Low';
      default:
        return quality.isEmpty ? 'Auto' : quality;
    }
  }

  ({String type, Color color}) _accountInfo(LicenseState state) {
    if (state is LicenseActive) {
      final license = state.license;
      if (license.isPremium) {
        return (type: 'Premium', color: const Color(AppColors.premiumGold));
      }
      if (license.durationDays != null && license.durationDays! <= 1) {
        return (type: 'Trial', color: const Color(AppColors.success));
      }
      return (type: 'Active', color: const Color(AppColors.success));
    }
    return (type: 'Free', color: AppColors.text2(context));
  }

  void _clearCache() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfElevated(ctx),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Clear Cache?',
          style: TextStyle(
            color: AppColors.text1(ctx),
            fontWeight: FontWeight.w800,
          ),
        ),
        content: Text(
          'This will remove cached channels and categories. Your account and license will not be affected.',
          style: TextStyle(
            color: AppColors.text2(ctx),
            fontSize: 13.5,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
              foregroundColor: const Color(AppColors.brandRed),
            ),
            child: const Text(
              'Clear',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    await StorageService().clearChannelCache();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Cache cleared'),
          backgroundColor: AppColors.surf(context),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfElevated(ctx),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Are you sure you want to logout?',
          style: TextStyle(
            color: AppColors.text1(ctx),
            fontWeight: FontWeight.w800,
          ),
        ),
        content: Text(
          'You will need to log in again to watch channels.',
          style: TextStyle(
            color: AppColors.text2(ctx),
            fontSize: 13.5,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(AppColors.brandRed),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              textStyle: const TextStyle(
                fontWeight: FontWeight.w800,
              ),
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }

  Future<void> _logout() async {
    await StorageService().clearAll();
    if (!mounted) return;
    context.read<AuthCubit>().logout();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showEditProfile() {
    if (_user == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EditProfileSheet(
        user: _user!,
        onSaved: _loadUser,
      ),
    );
  }

  void _showSmoothPlaybackInfo(LicenseState licenseState) {
    final isPremium = licenseState is LicenseActive && licenseState.license.isPremium;
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfElevated(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.div(ctx),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Smooth Playback',
              style: TextStyle(
                color: AppColors.text1(ctx),
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Smooth Playback pre-buffers live TV streams on the server so you get seamless, '
              'stutter-free viewing even on slower connections.',
              style: TextStyle(
                color: AppColors.text2(ctx),
                fontSize: 14,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surf(ctx),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.div(ctx)),
              ),
              child: Row(
                children: [
                  Icon(
                    isPremium ? Icons.check_circle_rounded : Icons.lock_rounded,
                    color: isPremium
                        ? const Color(AppColors.success)
                        : AppColors.textM(ctx),
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    isPremium
                        ? 'Available on your plan'
                        : 'Upgrade to Premium to unlock',
                    style: TextStyle(
                      color: isPremium
                          ? const Color(AppColors.success)
                          : AppColors.textM(ctx),
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showSupportOptions() {
    final config = context.read<AppConfigCubit>();
    final email = config.supportEmail;
    final whatsapp = config.supportWhatsapp;
    final telegram = config.supportTelegram;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfElevated(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final hasAny = email.isNotEmpty || whatsapp.isNotEmpty || telegram.isNotEmpty;
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.div(ctx),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Contact Support',
                style: TextStyle(
                  color: AppColors.text1(ctx),
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 16),
              if (!hasAny)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'No support contacts configured.',
                    style: TextStyle(color: AppColors.textM(ctx)),
                  ),
                ),
              if (whatsapp.isNotEmpty)
                _supportTile(
                  ctx: ctx,
                  icon: Icons.chat_rounded,
                  iconColor: const Color(0xFF25D366),
                  label: 'WhatsApp',
                  subtitle: whatsapp,
                  onTap: () {
                    final digits = whatsapp.replaceAll(RegExp(r'[^\d]'), '');
                    _launchUri(Uri.parse('https://wa.me/$digits'));
                  },
                ),
              if (email.isNotEmpty) ...[
                if (whatsapp.isNotEmpty) const SizedBox(height: 10),
                _supportTile(
                  ctx: ctx,
                  icon: Icons.email_outlined,
                  iconColor: const Color(AppColors.primary),
                  label: 'Email',
                  subtitle: email,
                  onTap: () => _launchUri(Uri.parse('mailto:$email')),
                ),
              ],
              if (telegram.isNotEmpty) ...[
                if (email.isNotEmpty || whatsapp.isNotEmpty) const SizedBox(height: 10),
                _supportTile(
                  ctx: ctx,
                  icon: Icons.send_rounded,
                  iconColor: const Color(0xFF2AABEE),
                  label: 'Telegram',
                  subtitle: telegram,
                  onTap: () => _launchUri(Uri.parse(telegram)),
                ),
              ],
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  Widget _supportTile({
    required BuildContext ctx,
    required IconData icon,
    required Color iconColor,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: () {
        Navigator.pop(ctx);
        onTap();
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surf(ctx),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.div(ctx)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: AppColors.text1(ctx),
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: AppColors.textM(ctx),
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: AppColors.textM(ctx),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _launchSettingsUrl(String key) async {
    final config = context.read<AppConfigCubit>();
    final urlStr = key == 'privacy' ? config.privacyPolicyUrl : config.termsUrl;
    if (urlStr.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('URL not configured'),
            backgroundColor: AppColors.surf(context),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }
    final uri = Uri.tryParse(urlStr);
    if (uri == null) return;
    await _launchUri(uri);
  }

  Future<void> _launchUri(Uri uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open link'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg(context),
      body: SafeArea(
        child: BlocBuilder<LicenseCubit, LicenseState>(
          builder: (context, licenseState) {
            final account = _accountInfo(licenseState);
            return LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Profile',
                          style: TextStyle(
                            color: AppColors.text1(context),
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.of(context)
                              .push(
                                MaterialPageRoute(
                                  builder: (_) => const PlaybackSettingsScreen(),
                                ),
                              )
                              .then((_) => _loadPlaybackSettings()),
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.surfLight(context),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppColors.div(context),
                                width: 0.8,
                              ),
                            ),
                            child: Icon(
                              Icons.settings_outlined,
                              size: 19,
                              color: AppColors.text2(context),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // User card
                  ProfileHeaderCard(
                    user: _user,
                    accountType: account.type,
                    accountColor: account.color,
                    onEditTap: _showEditProfile,
                  ),

                  const SizedBox(height: 18),

                  // License card
                  _buildLicenseCard(licenseState),

                  const SizedBox(height: 26),

                  // Playback section
                  _buildSectionTitle('Playback'),
                  _buildCard([
                    ProfileMenuTile(
                      icon: Icons.tune_rounded,
                      label: 'Playback Settings',
                      subtitle: 'Video quality & aspect ratio',
                      iconColor: const Color(AppColors.primary),
                      onTap: () => Navigator.of(context)
                          .push(
                            MaterialPageRoute(
                                builder: (_) => const PlaybackSettingsScreen()),
                          )
                          .then((_) => _loadPlaybackSettings()),
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.data_saver_on_rounded,
                      label: 'Data Saver Mode',
                      subtitle: _dataSaverEnabled ? 'Enabled' : 'Disabled',
                      iconColor: const Color(0xFF10B981),
                      onTap: () => Navigator.of(context)
                          .push(
                            MaterialPageRoute(
                                builder: (_) => const PlaybackSettingsScreen()),
                          )
                          .then((_) => _loadPlaybackSettings()),
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.hd_rounded,
                      label: 'Stream Quality Preference',
                      subtitle: _defaultQuality,
                      iconColor: const Color(0xFF8B5CF6),
                      onTap: () => Navigator.of(context)
                          .push(
                            MaterialPageRoute(
                                builder: (_) => const PlaybackSettingsScreen()),
                          )
                          .then((_) => _loadPlaybackSettings()),
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.speed_rounded,
                      label: 'Smooth Playback Status',
                      subtitle: 'Available',
                      iconColor: const Color(0xFF0EA5E9),
                      onTap: () => _showSmoothPlaybackInfo(licenseState),
                    ),
                  ]),

                  const SizedBox(height: 24),

                  // Support section
                  _buildSectionTitle('Help & Support'),
                  _buildCard([
                    ProfileMenuTile(
                      icon: Icons.support_agent_rounded,
                      label: 'Support',
                      subtitle: 'Get help from our team',
                      iconColor: const Color(0xFF0EA5E9),
                      onTap: _showSupportOptions,
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.report_problem_rounded,
                      label: 'Report Problem',
                      subtitle: 'Tell us about an issue',
                      iconColor: const Color(0xFFF59E0B),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const ReportProblemScreen()),
                      ),
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.policy_rounded,
                      label: 'Privacy Policy',
                      iconColor: const Color(0xFF64748B),
                      onTap: () => _launchSettingsUrl('privacy'),
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.description_rounded,
                      label: 'Terms of Service',
                      iconColor: const Color(0xFF64748B),
                      onTap: () => _launchSettingsUrl('terms'),
                    ),
                  ]),

                  const SizedBox(height: 24),

                  // Appearance section
                  _buildSectionTitle('Appearance'),
                  _buildCard([
                    BlocBuilder<ThemeCubit, ThemeMode>(
                      builder: (context, mode) {
                        String modeLabel = 'Dark Mode';
                        IconData modeIcon = Icons.dark_mode_rounded;
                        Color modeColor = const Color(AppColors.primary);
                        if (mode == ThemeMode.light) {
                          modeLabel = 'Light Mode';
                          modeIcon = Icons.light_mode_rounded;
                          modeColor = const Color(0xFFF59E0B);
                        } else if (mode == ThemeMode.system) {
                          modeLabel = 'System Default';
                          modeIcon = Icons.brightness_auto_rounded;
                          modeColor = const Color(0xFF0EA5E9);
                        }
                        return ProfileMenuTile(
                          icon: modeIcon,
                          label: 'App Theme',
                          subtitle: 'Tap to change',
                          iconColor: modeColor,
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: modeColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              modeLabel,
                              style: TextStyle(
                                color: modeColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          onTap: () => ThemeSelectorSheet.show(context),
                        );
                      },
                    ),
                  ]),

                  const SizedBox(height: 24),

                  // App section
                  _buildSectionTitle('App'),
                  _buildCard([
                    ProfileMenuTile(
                      icon: Icons.info_outline_rounded,
                      label: 'App Version',
                      subtitle: 'NivaTV v${AppConstants.appVersion}',
                      iconColor: const Color(AppColors.primary),
                      onTap: () {},
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.cleaning_services_rounded,
                      label: 'Clear Cache',
                      subtitle: 'Remove cached channels and categories',
                      iconColor: const Color(0xFF06B6D4),
                      onTap: _clearCache,
                    ),
                    _divider(),
                    ProfileMenuTile(
                      icon: Icons.logout_rounded,
                      label: 'Logout',
                      subtitle: 'Sign out of your account',
                      iconColor: const Color(AppColors.brandRed),
                      isDanger: true,
                      onTap: _confirmLogout,
                    ),
                  ]),

                  const SizedBox(height: AppConstants.bottomNavClearance),
                ],
              ),
              ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildLicenseCard(LicenseState state) {
    LicenseModel? license;
    bool isActive = false;
    bool isExpired = false;
    String? error;

    if (state is LicenseActive) {
      license = state.license;
      isActive = true;
    } else if (state is LicenseExpired) {
      license = state.license;
      isExpired = true;
    } else if (state is LicenseError) {
      if (!state.message.contains('DioException') && !state.message.contains('401')) {
        error = state.message;
      }
    }

    return LicenseStatusCard(
      license: license,
      isActive: isActive,
      isExpired: isExpired,
      error: error,
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LicenseStatusScreen()),
      ),
      onRenew: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LicenseStatusScreen()),
      ),
      onActivate: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          color: AppColors.textM(context),
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.surf(context),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.div(context),
          width: 0.8,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }

  Widget _divider() {
    return Divider(
      height: 0.5,
      thickness: 0.5,
      color: AppColors.div(context),
      indent: 66,
      endIndent: 16,
    );
  }
}
