import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubits/auth_cubit.dart';
import '../constants.dart';
import 'payment_screen.dart';
import 'login_screen.dart';

class LicenseExpiredScreen extends StatelessWidget {
  const LicenseExpiredScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
                child: const Icon(Icons.timer_off_outlined, size: 50, color: Color(AppColors.error)),
              ),
              const SizedBox(height: 32),
              Text(
                'Plan Expired',
                style: Theme.of(context).textTheme.headlineLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                'Your subscription plan has expired. Please renew your plan to continue watching premium channels.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(AppColors.textSecondary),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const PaymentScreen()),
                  );
                },
                child: const Text('View Plans & Renew'),
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
