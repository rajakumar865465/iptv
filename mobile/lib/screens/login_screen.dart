import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/auth_cubit.dart';
import '../cubits/license_cubit.dart';
import 'home_screen.dart';
import 'license_activation_screen.dart';
import 'license_expired_screen.dart';
import 'signup_screen.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _navigateAfterLogin(BuildContext context) async {
    try {
      final licenseCubit = context.read<LicenseCubit>();
      await licenseCubit.checkStatus();
      if (!context.mounted) return;
      final licenseState = context.read<LicenseCubit>().state;
      if (licenseState is LicenseActive) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      } else if (licenseState is LicenseExpired) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LicenseExpiredScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
        );
      }
    } catch (_) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            _navigateAfterLogin(context);
          } else if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message)),
            );
          } else if (state is AuthDeviceLimitReached) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: const Color(AppColors.surface),
                title: const Text('Device Limit Reached', style: TextStyle(color: Colors.white)),
                content: Text(state.message, style: const TextStyle(color: Colors.white70)),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      if (state.isGoogleLogin) {
                        context.read<AuthCubit>().loginWithGoogle(forceLogoutOldest: true);
                      } else {
                        context.read<AuthCubit>().login(
                          state.email,
                          state.password,
                          forceLogoutOldest: true,
                        );
                      }
                    },
                    child: const Text('Logout Oldest', style: TextStyle(color: Color(AppColors.primary))),
                  ),
                ],
              ),
            );
          }
        },
        builder: (context, state) {
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 40),
                  Center(
                    child: Column(
                      children: [
                        Image.asset(
                          'assets/images/logo.png',
                          width: 80,
                          height: 80,
                          fit: BoxFit.contain,
                        ),
                        const SizedBox(height: 10),
                        RichText(
                          text: TextSpan(
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                            children: const [
                              TextSpan(text: 'Niva', style: TextStyle(color: Colors.white)),
                              TextSpan(text: 'TV', style: TextStyle(color: Color(0xFFEF4444))),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  Text('Welcome Back!', style: Theme.of(context).textTheme.headlineLarge),
                  const SizedBox(height: 8),
                  Text('Sign in to continue', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(hintText: 'Email or Mobile'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    decoration: InputDecoration(
                      hintText: 'Password',
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    obscureText: _obscurePassword,
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: state is AuthLoading
                          ? null
                          : () {
                              final email = _emailController.text.trim();
                              final password = _passwordController.text;
                              if (email.isEmpty || password.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Please enter email and password')),
                                );
                                return;
                              }
                              context.read<AuthCubit>().login(email, password);
                            },
                      child: state is AuthLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Sign In'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                        );
                      },
                      child: const Text('Forgot Password?'),
                    ),
                  ),
                                    const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.g_mobiledata, size: 28),
                      label: const Text('Sign in with Google'),
                      onPressed: state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Colors.grey),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
const SizedBox(height: 16),
                  Center(
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SignupScreen()),
                        );
                      },
                      child: const Text('Don\'t have an account? Sign Up'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
