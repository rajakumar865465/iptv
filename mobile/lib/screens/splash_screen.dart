import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubits/app_config_cubit.dart';
import '../cubits/auth_cubit.dart';
import '../cubits/license_cubit.dart';
import '../constants.dart';
import '../services/storage_service.dart';
import 'blocked_screen.dart';
import 'force_update_screen.dart';
import 'home_screen.dart';
import 'license_activation_screen.dart';
import 'login_screen.dart';
import 'maintenance_screen.dart';
import 'onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAppStart();
  }

  Future<void> _checkAppStart() async {
    // Show splash for at least 2 seconds
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    // First, check if onboarding is complete
    final hasOnboarding = await StorageService().hasSeenOnboarding();
    if (!hasOnboarding && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const OnboardingScreen()),
      );
      return;
    }

    // Fetch app config first (maintenance, force update, etc.)
    await context.read<AppConfigCubit>().fetchConfig();
    if (!mounted) return;

    final appConfig = context.read<AppConfigCubit>().state;
    if (appConfig is AppConfigLoaded) {
      final config = appConfig.config;

      // Check maintenance mode
      if (config['maintenance_mode'] == 'true') {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MaintenanceScreen()),
        );
        return;
      }

      // Check force update
      if (config['force_update'] == 'true') {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const ForceUpdateScreen()),
        );
        return;
      }
    }

    // Check auth state
    final token = await StorageService().getToken();
    if (token != null && mounted) {
      // User logged in, check license
      await context.read<LicenseCubit>().checkStatus();
      if (!mounted) return;

      final licenseState = context.read<LicenseCubit>().state;
      if (licenseState is LicenseActive) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      } else if (licenseState is LicenseExpired || licenseState is LicenseNone) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    } else if (mounted) {
      // Not logged in
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(AppColors.primary),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.live_tv, size: 60, color: Colors.white),
            ),
            const SizedBox(height: 24),
            Text(
              'IPTV Live TV',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold, letterSpacing: 1.2),
            ),
            const SizedBox(height: 16),
            const SizedBox(
              width: 40,
              child: LinearProgressIndicator(
                backgroundColor: Color(AppColors.surface),
                valueColor: AlwaysStoppedAnimation<Color>(Color(AppColors.primary)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
