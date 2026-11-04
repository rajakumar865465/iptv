import 'package:flutter/material.dart';
import '../constants.dart';
import '../services/storage_service.dart';
import 'home_screen.dart';
import 'license_activation_screen.dart';
import 'login_screen.dart';
import 'signup_screen.dart';

/// Welcome Screen presented after onboarding completion or for new users.
/// Provides clear separation between account access, license activation,
/// and free preview browsing.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  void _navigateToLogin() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  void _navigateToSignUp() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SignupScreen()),
    );
  }

  void _navigateToLicenseActivation() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
    );
  }

  void _continueAsGuest() async {
    // Mark onboarding complete and allow user to preview channels on HomeScreen
    await StorageService().setFirstLaunchComplete();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = AppColors.bg(context);
    final text1 = AppColors.text1(context);
    final text2 = AppColors.text2(context);

    return Scaffold(
      backgroundColor: bgColor,
      body: Stack(
        children: [
          // Ambient lighting behind brand mark
          Positioned(
            top: -60,
            left: MediaQuery.of(context).size.width * 0.15,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(AppColors.primary).withOpacity(isDark ? 0.22 : 0.12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(AppColors.primary).withOpacity(isDark ? 0.35 : 0.2),
                    blurRadius: 100,
                    spreadRadius: 20,
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: 140,
            right: -50,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(AppColors.brandRed).withOpacity(isDark ? 0.14 : 0.08),
                boxShadow: [
                  BoxShadow(
                    color: const Color(AppColors.brandRed).withOpacity(isDark ? 0.2 : 0.1),
                    blurRadius: 80,
                    spreadRadius: 15,
                  ),
                ],
              ),
            ),
          ),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Top Skip / Free Preview action
                  Align(
                    alignment: Alignment.topRight,
                    child: TextButton.icon(
                      onPressed: _continueAsGuest,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        backgroundColor: isDark
                            ? Colors.white.withOpacity(0.06)
                            : Colors.black.withOpacity(0.04),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: isDark ? const Color(AppColors.divider) : const Color(0xFFE2E8F0),
                            width: 0.8,
                          ),
                        ),
                      ),
                      icon: Text(
                        'Preview Channels',
                        style: TextStyle(
                          color: text2,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      label: Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 11,
                        color: text2,
                      ),
                    ),
                  ),

                  const Spacer(flex: 2),

                  // Brand Hero Header
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 88,
                          height: 88,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: isDark
                                  ? const [Color(0xFF1E2342), Color(0xFF121528)]
                                  : const [Color(0xFFFFFFFF), Color(0xFFF1F5F9)],
                            ),
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(
                              color: isDark
                                  ? Colors.white.withOpacity(0.12)
                                  : const Color(0xFFCBD5E1),
                              width: 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(AppColors.primary).withOpacity(isDark ? 0.32 : 0.16),
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
                                width: 62,
                                height: 74,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        RichText(
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.8,
                              color: text1,
                            ),
                            children: const [
                              TextSpan(text: 'NIVA '),
                              TextSpan(
                                text: 'TV',
                                style: TextStyle(color: Color(AppColors.brandRed)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(AppColors.primary).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: const Color(AppColors.primary).withOpacity(0.25),
                              width: 0.8,
                            ),
                          ),
                          child: const Text(
                            'LIVE TELEVISION STREAMING',
                            style: TextStyle(
                              color: Color(AppColors.primaryLight),
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.4,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Your portal to 800+ broadcast channels,\nsports, movies & breaking news in full HD.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: text2,
                            fontSize: 14,
                            height: 1.45,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(flex: 3),

                  // Action Buttons Stack
                  // 1. Primary CTA: Sign In / Create Account
                  Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF4F46E5).withOpacity(0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _navigateToLogin,
                        borderRadius: BorderRadius.circular(16),
                        child: const Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.login_rounded, color: Colors.white, size: 20),
                              SizedBox(width: 10),
                              Text(
                                'Sign In / Register',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // 2. Secondary CTA: Activate with License Key
                  Container(
                    height: 52,
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(AppColors.surfaceElevated)
                          : const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isDark
                            ? const Color(AppColors.divider)
                            : const Color(0xFFE2E8F0),
                        width: 1.2,
                      ),
                      boxShadow: isDark
                          ? null
                          : [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _navigateToLicenseActivation,
                        borderRadius: BorderRadius.circular(16),
                        child: Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.vpn_key_rounded,
                                color: isDark
                                    ? const Color(AppColors.primaryLight)
                                    : const Color(AppColors.primary),
                                size: 19,
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Activate with License Key',
                                style: TextStyle(
                                  color: text1,
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),

                  // 3. Quick Account Creation link
                  Center(
                    child: GestureDetector(
                      onTap: _navigateToSignUp,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: RichText(
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 13.5,
                              color: text2,
                            ),
                            children: [
                              const TextSpan(text: 'New to NIVA TV? '),
                              TextSpan(
                                text: 'Create Free Account',
                                style: TextStyle(
                                  color: isDark
                                      ? const Color(AppColors.primaryLight)
                                      : const Color(AppColors.primary),
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
