import 'package:flutter/material.dart';
import '../constants.dart';

class ForceUpdateScreen extends StatelessWidget {
  const ForceUpdateScreen({super.key});

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
              Icon(Icons.system_update, size: 80, color: const Color(AppColors.primary)),
              const SizedBox(height: 24),
              Text(
                'Update Required',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 16),
              Text(
                'A new version is required. Please update the app to continue.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(AppColors.textSecondary)),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () {
                  // Launch app store or APK download
                },
                child: const Text('Update Now'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
