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

  void _submitLogin() {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter email and password')),
      );
      return;
    }
    context.read<AuthCubit>().login(email, password);
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
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: const Color(AppColors.error),
                duration: const Duration(seconds: 5),
              ),
            );
          } else if (state is AuthDeviceLimitReached) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: const Color(AppColors.surface),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: const BorderSide(color: Color(AppColors.divider)),
                ),
                title: const Text(
                  'Device Limit Reached',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                ),
                content: Text(
                  state.message,
                  style: const TextStyle(color: Color(AppColors.textSecondary)),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel', style: TextStyle(color: Color(AppColors.textMuted))),
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
                    child: const Text(
                      'Logout Oldest',
                      style: TextStyle(
                        color: Color(AppColors.brandRed),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }
        },
        builder: (context, state) {
          final isGoogleLoading = state is AuthLoading && state.isGoogle;
          final isEmailLoading = state is AuthLoading && !state.isGoogle;

          return Stack(
            children: [
              // Ambient top-left Indigo glow
              Positioned(
                top: -80,
                left: -60,
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(AppColors.primary).withOpacity(0.16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(AppColors.primary).withOpacity(0.22),
                        blurRadius: 100,
                        spreadRadius: 30,
                      ),
                    ],
                  ),
                ),
              ),
              // Ambient top-right Crimson glow
              Positioned(
                top: -40,
                right: -70,
                child: Container(
                  width: 200,
                  height: 200,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(AppColors.brandRed).withOpacity(0.12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(AppColors.brandRed).withOpacity(0.16),
                        blurRadius: 90,
                        spreadRadius: 24,
                      ),
                    ],
                  ),
                ),
              ),
              SafeArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 24),
                      // Single Illuminated Brand Mark (crops out the dark duplicate text inside logo.png)
                      Center(
                        child: Column(
                          children: [
                            Container(
                              width: 78,
                              height: 78,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0xFF181C36),
                                    Color(0xFF101223),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.12),
                                  width: 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(AppColors.primary).withOpacity(0.28),
                                    blurRadius: 28,
                                    offset: const Offset(0, 10),
                                  ),
                                ],
                              ),
                              child: ClipRect(
                                child: Align(
                                  alignment: Alignment.topCenter,
                                  heightFactor: 0.72,
                                  child: Image.asset(
                                    'assets/images/logo.png',
                                    width: 56,
                                    height: 68,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            RichText(
                              text: const TextSpan(
                                style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                                children: [
                                  TextSpan(
                                    text: 'Niva',
                                    style: TextStyle(color: Colors.white),
                                  ),
                                  TextSpan(
                                    text: 'TV',
                                    style: TextStyle(color: Color(AppColors.brandRed)),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.05),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.08),
                                  width: 0.8,
                                ),
                              ),
                              child: const Text(
                                'PREMIUM LIVE TV & ENTERTAINMENT',
                                style: TextStyle(
                                  color: Color(AppColors.textSecondary),
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.1,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 36),
                      const Text(
                        'Welcome Back',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.6,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Sign in to access 800+ live HD channels across your devices.',
                        style: TextStyle(
                          color: Color(AppColors.textSecondary),
                          fontSize: 13.5,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 26),
                      const Text(
                        'Email or Mobile Number',
                        style: TextStyle(
                          color: Color(AppColors.textSecondary),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        style: const TextStyle(color: Colors.white, fontSize: 14.5),
                        decoration: const InputDecoration(
                          hintText: 'Enter your email or mobile',
                          prefixIcon: Icon(Icons.alternate_email_rounded, size: 20),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Password',
                            style: TextStyle(
                              color: Color(AppColors.textSecondary),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                              );
                            },
                            child: const Text(
                              'Forgot Password?',
                              style: TextStyle(
                                color: Color(AppColors.primary),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: const TextStyle(color: Colors.white, fontSize: 14.5),
                        onSubmitted: (_) => _submitLogin(),
                        decoration: InputDecoration(
                          hintText: 'Enter your password',
                          prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                            ),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                        ),
                      ),
                      const SizedBox(height: 26),
                      // Signature Indigo -> Crimson Gradient CTA Button
                      GestureDetector(
                        onTap: state is AuthLoading ? null : _submitLogin,
                        child: Container(
                          width: double.infinity,
                          height: 54,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: state is AuthLoading
                                  ? [
                                      const Color(AppColors.surfaceElevated),
                                      const Color(AppColors.surfaceElevated),
                                    ]
                                  : const [
                                      Color(AppColors.primary),
                                      Color(AppColors.brandRed),
                                    ],
                            ),
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: state is AuthLoading
                                ? null
                                : [
                                    BoxShadow(
                                      color: const Color(AppColors.primary).withOpacity(0.35),
                                      blurRadius: 18,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                          ),
                          alignment: Alignment.center,
                          child: isEmailLoading
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      'Sign In',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 15.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                    SizedBox(width: 8),
                                    Icon(
                                      Icons.arrow_forward_rounded,
                                      color: Colors.white,
                                      size: 18,
                                    ),
                                  ],
                                ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      // Divider: OR CONTINUE WITH
                      Row(
                        children: [
                          const Expanded(child: Divider(color: Color(AppColors.divider))),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: Text(
                              'OR CONTINUE WITH',
                              style: TextStyle(
                                color: const Color(AppColors.textMuted).withOpacity(0.85),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.0,
                              ),
                            ),
                          ),
                          const Expanded(child: Divider(color: Color(AppColors.divider))),
                        ],
                      ),
                      const SizedBox(height: 20),
                      // Glassmorphic Google Sign-In Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: OutlinedButton(
                          onPressed: state is AuthLoading
                              ? null
                              : () => context.read<AuthCubit>().loginWithGoogle(),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: const Color(AppColors.surface),
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Color(AppColors.divider), width: 1),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (isGoogleLoading)
                                const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              else
                                Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Text(
                                    'G',
                                    style: TextStyle(
                                      color: Color(0xFF4285F4),
                                      fontSize: 15,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              const SizedBox(width: 12),
                              Text(
                                isGoogleLoading
                                    ? 'Connecting to Google...'
                                    : 'Continue with Google',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Center(
                        child: GestureDetector(
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const SignupScreen()),
                            );
                          },
                          child: RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 13.5,
                                color: Color(AppColors.textSecondary),
                              ),
                              children: [
                                TextSpan(text: "Don't have an account? "),
                                TextSpan(
                                  text: 'Sign Up',
                                  style: TextStyle(
                                    color: Color(AppColors.primary),
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Center(
                        child: TextButton.icon(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
                            );
                          },
                          icon: const Icon(
                            Icons.vpn_key_outlined,
                            size: 14,
                            color: Color(AppColors.primaryLight),
                          ),
                          label: const Text(
                            'Have a License Key? Activate Here',
                            style: TextStyle(
                              color: Color(AppColors.primaryLight),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
