import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/license_cubit.dart';
import 'home_screen.dart';

class LicenseActivationScreen extends StatefulWidget {
  const LicenseActivationScreen({super.key});

  @override
  State<LicenseActivationScreen> createState() => _LicenseActivationScreenState();
}

class _LicenseActivationScreenState extends State<LicenseActivationScreen> {
  final _licenseController = TextEditingController();

  @override
  void dispose() {
    _licenseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: BlocProvider(
        create: (_) => LicenseCubit(),
        child: BlocConsumer<LicenseCubit, LicenseState>(
          listener: (context, state) {
            if (state is LicenseActive) {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const HomeScreen()),
              );
            } else if (state is LicenseError) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(state.message)),
              );
            }
          },
          builder: (context, state) {
            return SafeArea(
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
                        color: const Color(AppColors.primary),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: const Icon(Icons.vpn_key, size: 50, color: Colors.white),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      'Activate Your License',
                      style: Theme.of(context).textTheme.headlineLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Enter your license key to unlock all channels',
                      style: Theme.of(context).textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    TextField(
                      controller: _licenseController,
                      decoration: const InputDecoration(
                        hintText: 'XXXX-XXXX-XXXX-XXXX',
                        prefixIcon: Icon(Icons.vpn_key_outlined),
                      ),
                      textAlign: TextAlign.center,
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: state is LicenseLoading
                          ? null
                          : () {
                              if (_licenseController.text.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Please enter a license key')),
                                );
                                return;
                              }
                              context.read<LicenseCubit>().activate(_licenseController.text.trim());
                            },
                      child: state is LicenseLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Activate'),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () {
                        // Navigate to payment screen or support
                      },
                      child: const Text('Need a license? Contact Support'),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
