import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubits/auth_cubit.dart';
import '../constants.dart';
import '../models/license_model.dart';
import 'license_activation_screen.dart';
import 'payment_screen.dart';
import 'login_screen.dart';

class LicenseExpiredScreen extends StatelessWidget {
  final LicenseModel? license;

  const LicenseExpiredScreen({super.key, this.license});

  @override
  Widget build(BuildContext context) {
    final isRevoked = license?.isRevoked == true;
    final isSuspended = license?.isSuspended == true;
    final isBlocked = license?.isBlocked == true;
    final isPending = license?.isPendingPayment == true;

    IconData icon = Icons.timer_off_outlined;
    String title = 'Plan Expired';
    String message =
        'Your subscription plan has expired. Please renew your plan or activate a new license key to continue watching.';

    if (isRevoked) {
      icon = Icons.block_rounded;
      title = 'License Revoked';
      message =
          'Your license key has been revoked. Please contact support or activate a new license key to continue watching.';
    } else if (isSuspended) {
      icon = Icons.pause_circle_outline_rounded;
      title = 'License Suspended';
      message =
          'Your license is temporarily suspended. Please contact support or renew with a new plan to continue watching.';
    } else if (isBlocked) {
      icon = Icons.gpp_bad_outlined;
      title = 'License Blocked';
      message =
          'This license has been blocked. Please contact support for assistance.';
    } else if (isPending) {
      icon = Icons.hourglass_top_rounded;
      title = 'Payment Pending';
      message =
          'Your license payment is still pending confirmation. Complete payment or activate an active key to continue watching.';
    }

    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(AppColors.error).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 50, color: const Color(AppColors.error)),
              ),
              const SizedBox(height: 32),
              Text(
                title,
                style: Theme.of(context).textTheme.headlineLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(AppColors.textSecondary),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const PaymentScreen()),
                  );
                },
                child: const Text('View Plans & Renew'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(AppColors.textPrimary),
                  side: const BorderSide(color: Color(AppColors.divider)),
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Activate License Key'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () async {
                  await context.read<AuthCubit>().logout();
                  if (context.mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (route) => false,
                    );
                  }
                },
                child: const Text('Logout', style: TextStyle(color: Color(AppColors.textSecondary))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
