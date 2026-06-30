import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubits/app_config_cubit.dart';
import '../cubits/auth_cubit.dart';
import '../cubits/license_cubit.dart';
import '../cubits/channel_cubit.dart';
import '../constants.dart';
import '../services/storage_service.dart';
import 'blocked_screen.dart';
import 'force_update_screen.dart';
import 'home_screen.dart';
import 'license_activation_screen.dart';
import 'login_screen.dart';
import 'maintenance_screen.dart';
import 'package:dio/dio.dart';
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

    if (!context.mounted) return;

    // First, check if onboarding is complete
    final hasOnboarding = await StorageService().hasSeenOnboarding();
    if (!hasOnboarding && context.mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const OnboardingScreen()),
      );
      return;
    }

    // Fetch app config first (maintenance, force update, etc.)
    await context.read<AppConfigCubit>().fetchConfig();
    if (!context.mounted) return;

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

    // Check auth state and validate user on backend
    final token = await StorageService().getToken();
    if (token != null && context.mounted) {
      // Validate token and get fresh user/me data
      try {
        final authCubit = context.read<AuthCubit>();
        authCubit.setToken(token); // Ensure token is set on auth service

        // Verify token is still valid by calling /me
        Map<String, dynamic>? meResult;
        bool isNetworkError = false;
        
        try {
          meResult = await authCubit.me(throwOnError: true);
        } catch (e) {
          if (e is DioException) {
            if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
              // Token invalid - clear and go to login
              await StorageService().clearAll();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
              return;
            } else if (
              e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.receiveTimeout ||
              e.type == DioExceptionType.sendTimeout
            ) {
              isNetworkError = true;
            }
          }
        }

        if (meResult == null && !isNetworkError) {
          // Token invalid or other error - clear and go to login
          await StorageService().clearAll();
          if (context.mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            );
          }
          return;
        }

        // Check user status
        if (meResult != null && meResult['status'] == 'blocked') {
          if (context.mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const BlockedScreen()),
            );
          }
          return;
        }

        // User valid, check license status
        final licenseCubit = context.read<LicenseCubit>();
        await licenseCubit.checkStatus();
        if (!context.mounted) return;

        final licenseState = context.read<LicenseCubit>().state;
        if (licenseState is LicenseActive || (isNetworkError && licenseState is LicenseError)) {
          await context.read<ChannelCubit>().loadChannels();
          if (context.mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const HomeScreen()),
            );
          }
        } else if (licenseState is LicenseExpired ||
                   licenseState is LicenseNone ||
                   licenseState is LicenseError) {
          if (context.mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
            );
          }
        } else {
          if (context.mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            );
          }
        }
      } catch (e) {
        // On unexpected error, fall back to login
        if (context.mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
          );
        }
      }
    } else if (context.mounted) {
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
            Image.asset(
              'assets/images/logo.png',
              width: 96,
              height: 96,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 20),
            RichText(
              text: TextSpan(
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
                children: const [
                  TextSpan(text: 'Niva', style: TextStyle(color: Colors.white)),
                  TextSpan(text: 'TV', style: TextStyle(color: Color(0xFFEF4444))),
                ],
              ),
            ),
            const SizedBox(height: 32),
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
