import 'package:flutter/material.dart';
import '../constants.dart';

class BlockedScreen extends StatelessWidget {
  const BlockedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.block, size: 80, color: const Color(AppColors.error)),
              const SizedBox(height: 24),
              Text(
                'Account Blocked',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 16),
              Text(
                'Your account has been blocked. Please contact support.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(AppColors.textSecondary)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
