import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/auth_cubit.dart';
import '../cubits/license_cubit.dart';
import 'login_screen.dart';
import 'license_status_screen.dart';
import 'license_activation_screen.dart';
import 'playback_settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    context.read<LicenseCubit>().checkStatus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        elevation: 0,
        title: const Text('Profile', style: TextStyle(color: Colors.white)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _buildProfileHeader(),
            const SizedBox(height: 24),
            BlocBuilder<LicenseCubit, LicenseState>(
              builder: (context, state) {
                if (state is LicenseActive) {
                  return _buildLicenseCard(state.license, true);
                } else if (state is LicenseExpired) {
                  return _buildLicenseCard(state.license, false);
                } else if (state is LicenseError) {
                  return _buildLicenseCard(null, false, error: state.message);
                }
                return _buildNoLicenseCard();
              },
            ),
            const SizedBox(height: 24),
            _buildMenuSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(AppColors.primary), Color(0xFFB71C1C)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 40,
            backgroundColor: Colors.white24,
            child: Icon(Icons.person, size: 40, color: Colors.white),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'User',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                SizedBox(height: 4),
                Text(
                  'user@example.com',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLicenseCard(dynamic license, bool isActive, {String? error}) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LicenseStatusScreen()));
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF1B5E20) : error != null ? const Color(AppColors.surface) : const Color(0xFF7F6000),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isActive ? Icons.verified : error != null ? Icons.error : Icons.cancel,
                  color: Colors.white,
                ),
                const SizedBox(width: 8),
                Text(
                  isActive
                      ? 'License Active'
                      : error != null
                          ? 'License Check Failed'
                          : 'License ${license?.status ?? 'Expired'}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
            if (isActive && license?.remainingDays != null) ...[
              const SizedBox(height: 8),
              Text(
                '${license.remainingDays} days remaining',
                style: const TextStyle(color: Colors.white70),
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                error,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNoLicenseCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(AppColors.surface),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning, color: Color(AppColors.warning)),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('No Active License', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                    Text('Activate a license to watch live TV', style: TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LicenseActivationScreen()));
              },
              child: const Text('Activate License'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuSection() {
    return Column(
      children: [
        _buildMenuItem(Icons.settings_play_arrow, 'Playback Settings', () {
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlaybackSettingsScreen()));
        }),
        _buildMenuItem(Icons.support_agent, 'Support', () {}),
        _buildMenuItem(Icons.policy, 'Privacy Policy', () {}),
        _buildMenuItem(Icons.description, 'Terms of Service', () {}),
        const Divider(color: Color(AppColors.surfaceLight)),
        _buildMenuItem(Icons.logout, 'Logout', () {
          context.read<AuthCubit>().logout();
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
            (route) => false,
          );
        }, isDanger: true),
      ],
    );
  }

  Widget _buildMenuItem(IconData icon, String label, VoidCallback onTap, {bool isDanger = false}) {
    return ListTile(
      leading: Icon(icon, color: isDanger ? const Color(AppColors.error) : Colors.white),
      title: Text(label, style: TextStyle(color: isDanger ? const Color(AppColors.error) : Colors.white)),
      trailing: const Icon(Icons.chevron_right, color: Colors.white54),
      onTap: onTap,
    );
  }
}
