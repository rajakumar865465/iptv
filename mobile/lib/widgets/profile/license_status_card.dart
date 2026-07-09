import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../constants.dart';
import '../../models/license_model.dart';

/// Premium license status card.
///
/// Shows green gradient when active, red/orange when expired or expiring soon,
/// and an activation prompt when no license exists.
class LicenseStatusCard extends StatelessWidget {
  final LicenseModel? license;
  final bool isActive;
  final bool isExpired;
  final String? error;
  final VoidCallback? onTap;
  final VoidCallback? onRenew;
  final VoidCallback? onActivate;

  const LicenseStatusCard({
    super.key,
    this.license,
    this.isActive = false,
    this.isExpired = false,
    this.error,
    this.onTap,
    this.onRenew,
    this.onActivate,
  });

  bool get _isExpiringSoon {
    if (!isActive) return false;
    final days = license?.remainingDays;
    if (days == null) return false;
    return days > 0 && days <= 5;
  }

  bool get _isTrial =>
      isActive && license?.durationDays != null && license!.durationDays! <= 1;

  List<Color> get _gradientColors {
    if (isExpired) {
      return const [
        Color(0xFF3A0F0F),
        Color(0xFF2A0A15),
      ];
    }
    if (_isExpiringSoon) {
      return const [
        Color(0xFF3A240A),
        Color(0xFF2A1508),
      ];
    }
    if (isActive) {
      return const [
        Color(0xFF0A2E1F),
        Color(0xFF0A1F18),
      ];
    }
    return const [
      Color(0xFF1A0A2E),
      Color(0xFF0A1A30),
    ];
  }

  Color get _accentColor {
    if (isExpired) return const Color(AppColors.error);
    if (_isExpiringSoon) return const Color(AppColors.warning);
    if (isActive) return const Color(AppColors.success);
    return const Color(AppColors.premiumGold);
  }

  String get _statusTitle {
    if (isExpired) return 'License Expired';
    if (_isExpiringSoon) return 'Expiring Soon';
    if (isActive) return _isTrial ? 'Trial Active' : 'License Active';
    return 'No Active License';
  }

  String get _subtitle {
    if (isExpired) {
      return 'Renew your plan to continue watching.';
    }
    if (_isExpiringSoon) {
      return '${license?.remainingDays ?? 0} days remaining • Renew now to stay active.';
    }
    if (isActive) {
      final plan = license?.planName ?? 'Premium Plan';
      final days = license?.remainingDays;
      if (days != null) return '$days days remaining • $plan';
      return plan;
    }
    return 'Activate a license to watch Live TV.';
  }

  @override
  Widget build(BuildContext context) {
    if (!isActive && !isExpired) {
      return _NoLicenseCard(error: error, onActivate: onActivate);
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: _gradientColors,
          ),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: _accentColor.withOpacity(0.25),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: _accentColor.withOpacity(0.15),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: _accentColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _accentColor.withOpacity(0.25),
                      width: 0.8,
                    ),
                  ),
                  child: Icon(
                    isExpired ? Icons.warning_amber_rounded : Icons.verified_rounded,
                    color: _accentColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _statusTitle,
                        style: TextStyle(
                          color: _accentColor,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _subtitle,
                        style: const TextStyle(
                          color: Color(AppColors.textSecondary),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          height: 1.3,
                        ),
                      ),
                      if (license?.expiresAt != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Expires on ${DateFormat('dd MMM yyyy').format(license!.expiresAt!)}',
                          style: TextStyle(
                            color: const Color(AppColors.textMuted).withOpacity(0.9),
                            fontSize: 11.5,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: _accentColor.withOpacity(0.5),
                  size: 20,
                ),
              ],
            ),
            if (_isExpiringSoon && onRenew != null) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onRenew,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _accentColor,
                    foregroundColor: Colors.black,
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w900,
                    ),
                    elevation: 0,
                    shadowColor: Colors.transparent,
                  ),
                  child: const Text('Renew Plan'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NoLicenseCard extends StatelessWidget {
  final String? error;
  final VoidCallback? onActivate;

  const _NoLicenseCard({this.error, this.onActivate});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF1A0A2E),
            Color(0xFF0A1A30),
          ],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(AppColors.primary).withOpacity(0.25),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(AppColors.premiumGold).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.workspace_premium_rounded,
                  color: Color(AppColors.premiumGold),
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No Active License',
                      style: TextStyle(
                        color: Color(AppColors.textPrimary),
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.2,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Activate a license to unlock Live TV and premium features.',
                      style: TextStyle(
                        color: Color(AppColors.textSecondary),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(
              error!,
              style: const TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 11.5,
              ),
            ),
          ],
          if (onActivate != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onActivate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppColors.primary),
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                  ),
                  elevation: 0,
                  shadowColor: Colors.transparent,
                ),
                child: const Text('Activate License'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
