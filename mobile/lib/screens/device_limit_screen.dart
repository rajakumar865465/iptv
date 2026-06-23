import 'package:flutter/material.dart';
import '../constants.dart';

class DeviceLimitScreen extends StatelessWidget {
  const DeviceLimitScreen({super.key});

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
              const Icon(Icons.devices, size: 80, color: Color(AppColors.warning)),
              const SizedBox(height: 24),
              Text(
                'Device Limit Reached',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 16),
              Text(
                'You have reached the maximum number of devices allowed. Please contact support.',
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
