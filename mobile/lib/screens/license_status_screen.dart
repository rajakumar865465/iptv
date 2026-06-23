import 'package:flutter/material.dart';
import '../constants.dart';

class LicenseStatusScreen extends StatelessWidget {
  const LicenseStatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        elevation: 0,
        title: const Text('License Status', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: const Center(
        child: Text(' License status details will be shown here.', style: TextStyle(color: Colors.white)),
      ),
    );
  }
}
