import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/license_cubit.dart';
import '../utils/force_update_helper.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'payment_screen.dart';

/// Professional License Key Activation Screen for NIVA TV.
/// Features clipboard paste support, key sanitization, input validation,
/// entitlement summary, device-limit handling, and adaptive theme support.
class LicenseActivationScreen extends StatefulWidget {
  const LicenseActivationScreen({super.key});

  @override
  State<LicenseActivationScreen> createState() => _LicenseActivationScreenState();
}

class _LicenseActivationScreenState extends State<LicenseActivationScreen> {
  final _licenseController = TextEditingController();
  bool _isObscured = false;
  String? _validationError;

  @override
  void initState() {
    super.initState();
    _licenseController.addListener(() {
      if (_validationError != null) {
        setState(() => _validationError = null);
      }
    });
  }

  @override
  void dispose() {
    _licenseController.dispose();
    super.dispose();
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null && data!.text!.trim().isNotEmpty) {
      final cleaned = data.text!.trim().toUpperCase();
      setState(() {
        _licenseController.text = cleaned;
        _licenseController.selection = TextSelection.fromPosition(
          TextPosition(offset: cleaned.length),
        );
        _validationError = null;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('License key pasted from clipboard'),
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clipboard is empty'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _submitActivation() {
    final rawKey = _licenseController.text.trim();
    if (rawKey.isEmpty) {
      setState(() => _validationError = 'Please enter your license key');
      return;
    }
    if (rawKey.length < 8) {
      setState(() => _validationError = 'License key format is too short');
      return;
    }

    setState(() => _validationError = null);
    context.read<LicenseCubit>().activate(rawKey.toUpperCase());
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = AppColors.bg(context);
    final text1 = AppColors.text1(context);
    final text2 = AppColors.text2(context);
    final surfColor = isDark
        ? const Color(AppColors.surface)
        : const Color(0xFFFFFFFF);
    final borderColor = isDark
        ? const Color(AppColors.divider)
        : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Navigator.of(context).canPop()
            ? IconButton(
                icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: text1),
                onPressed: () => Navigator.of(context).pop(),
              )
            : null,
        title: Text(
          'Activate License',
          style: TextStyle(
            color: text1,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        centerTitle: true,
      ),
      body: BlocConsumer<LicenseCubit, LicenseState>(
        listener: (context, state) {
          if (state is LicenseForceUpdateRequired) {
            ForceUpdateHelper.navigateToForceUpdate(
              info: state.info,
              navigator: Navigator.of(context),
            );
            return;
          }
          if (state is LicenseActive) {
            if (ForceUpdateHelper.isActive) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text('License activated successfully! Welcome to NIVA TV.'),
                    ),
                  ],
                ),
                backgroundColor: Color(AppColors.success),
                behavior: SnackBarBehavior.floating,
                duration: Duration(seconds: 3),
              ),
            );
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const HomeScreen()),
            );
          } else if (state is LicenseError) {
            if (ForceUpdateHelper.isActive) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(state.message)),
                  ],
                ),
                backgroundColor: const Color(AppColors.error),
                behavior: SnackBarBehavior.floating,
                duration: const Duration(seconds: 4),
              ),
            );
          } else if (state is LicenseDeviceLimitReached) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: surfColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(color: borderColor),
                ),
                title: Text(
                  'Device Limit Reached',
                  style: TextStyle(color: text1, fontWeight: FontWeight.w800),
                ),
                content: Text(
                  state.message,
                  style: TextStyle(color: text2, height: 1.4),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text('Cancel', style: TextStyle(color: AppColors.textM(context))),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      context.read<LicenseCubit>().activate(
                            state.licenseKey,
                            forceLogoutOldest: true,
                          );
                    },
                    child: const Text(
                      'Logout Oldest Device',
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
          final isLoading = state is LicenseLoading;

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 12),

                  // Illuminated Key Pedestal
                  Center(
                    child: Container(
                      width: 84,
                      height: 84,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0xFF4F46E5),
                            Color(0xFF6366F1),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(26),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF4F46E5).withOpacity(0.35),
                            blurRadius: 28,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.vpn_key_rounded,
                          size: 40,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Title & Subtitle
                  Text(
                    'Unlock Full Access',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: text1,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Enter your 16-character license key to activate\ninstant access to all 800+ live HD channels.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: text2,
                      fontSize: 13.5,
                      height: 1.45,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Input Field Label & Actions
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'LICENSE KEY',
                        style: TextStyle(
                          color: text2,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _pasteFromClipboard,
                        style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        icon: const Icon(
                          Icons.content_paste_rounded,
                          size: 15,
                          color: Color(AppColors.primaryLight),
                        ),
                        label: const Text(
                          'Paste Key',
                          style: TextStyle(
                            color: Color(AppColors.primaryLight),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 6),

                  // License Key Input Box
                  Container(
                    decoration: BoxDecoration(
                      color: surfColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _validationError != null
                            ? const Color(AppColors.error)
                            : borderColor,
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
                    child: Row(
                      children: [
                        const SizedBox(width: 16),
                        Icon(
                          Icons.vpn_key_outlined,
                          size: 20,
                          color: AppColors.textM(context),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: _licenseController,
                            obscureText: _isObscured,
                            textCapitalization: TextCapitalization.characters,
                            style: TextStyle(
                              color: text1,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.2,
                              fontFamily: 'monospace',
                            ),
                            decoration: InputDecoration(
                              hintText: 'XXXX-XXXX-XXXX-XXXX',
                              hintStyle: TextStyle(
                                color: AppColors.textM(context).withOpacity(0.6),
                                letterSpacing: 1.2,
                                fontSize: 13.5,
                              ),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                          ),
                        ),
                        if (_licenseController.text.isNotEmpty)
                          IconButton(
                            icon: Icon(
                              Icons.clear_rounded,
                              size: 18,
                              color: AppColors.textM(context),
                            ),
                            onPressed: () {
                              _licenseController.clear();
                              setState(() => _validationError = null);
                            },
                          ),
                        IconButton(
                          icon: Icon(
                            _isObscured
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 19,
                            color: AppColors.textM(context),
                          ),
                          onPressed: () {
                            setState(() => _isObscured = !_isObscured);
                          },
                        ),
                        const SizedBox(width: 6),
                      ],
                    ),
                  ),

                  if (_validationError != null) ...[
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            size: 14,
                            color: Color(AppColors.error),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _validationError!,
                            style: const TextStyle(
                              color: Color(AppColors.error),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Activate CTA Button
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
                        onTap: isLoading ? null : _submitActivation,
                        borderRadius: BorderRadius.circular(16),
                        child: Center(
                          child: isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.bolt_rounded, color: Colors.white, size: 20),
                                    SizedBox(width: 8),
                                    Text(
                                      'Activate License',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 15.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Value & Entitlements Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(AppColors.surfaceElevated).withOpacity(0.5)
                          : const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: borderColor, width: 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.verified_rounded,
                              size: 18,
                              color: Color(AppColors.premiumGold),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'What you unlock with a License:',
                              style: TextStyle(
                                color: text1,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildEntitlementRow('800+ Live Indian & Global Broadcasts', text2),
                        const SizedBox(height: 8),
                        _buildEntitlementRow('Crystal clear Full HD & 4K streams', text2),
                        const SizedBox(height: 8),
                        _buildEntitlementRow('Zero stutter & buffer-free playback', text2),
                        const SizedBox(height: 8),
                        _buildEntitlementRow('Multi-device account synchronization', text2),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Secondary Actions
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PaymentScreen()),
                          );
                        },
                        child: const Text(
                          'Need a License? View Plans',
                          style: TextStyle(
                            color: Color(AppColors.primaryLight),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text('•', style: TextStyle(color: AppColors.textM(context))),
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                          );
                        },
                        child: Text(
                          'Sign In',
                          style: TextStyle(
                            color: text2,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEntitlementRow(String text, Color textColor) {
    return Row(
      children: [
        Container(
          width: 5,
          height: 5,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(AppColors.primaryLight),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: textColor,
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
