import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/license_cubit.dart';
import '../models/license_model.dart';
import 'license_activation_screen.dart';
import 'payment_screen.dart';

class LicenseStatusScreen extends StatefulWidget {
  const LicenseStatusScreen({super.key});

  @override
  State<LicenseStatusScreen> createState() => _LicenseStatusScreenState();
}

class _LicenseStatusScreenState extends State<LicenseStatusScreen> {
  @override
  void initState() {
    super.initState();
    context.read<LicenseCubit>().checkStatus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        foregroundColor: const Color(AppColors.textPrimary),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'License Status',
          style: TextStyle(
            color: Color(AppColors.textPrimary),
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 22),
            tooltip: 'Refresh',
            onPressed: () => context.read<LicenseCubit>().checkStatus(),
          ),
        ],
      ),
      body: BlocBuilder<LicenseCubit, LicenseState>(
        builder: (context, state) {
          if (state is LicenseLoading || state is LicenseInitial) {
            return const Center(
              child: CircularProgressIndicator(
                color: Color(AppColors.primary),
                strokeWidth: 2.5,
              ),
            );
          }
          if (state is LicenseError) {
            return _buildError(state.message);
          }
          if (state is LicenseNone) {
            return _buildNoLicense();
          }
          if (state is LicenseActive) {
            return _buildContent(state.license, isActive: true);
          }
          if (state is LicenseExpired) {
            return _buildContent(state.license, isActive: false);
          }
          return _buildNoLicense();
        },
      ),
    );
  }

  // ─── States ────────────────────────────────────────────────────────────────

  Widget _buildError(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(AppColors.error).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.wifi_off_rounded,
                  color: Color(AppColors.error), size: 36),
            ),
            const SizedBox(height: 20),
            const Text(
              'Could not load license',
              style: TextStyle(
                color: Color(AppColors.textPrimary),
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(AppColors.textSecondary),
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            _primaryButton(
              label: 'Try Again',
              icon: Icons.refresh_rounded,
              onTap: () => context.read<LicenseCubit>().checkStatus(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoLicense() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          const SizedBox(height: 24),
          // Status badge
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: const Color(AppColors.textMuted).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_outline_rounded,
              size: 44,
              color: Color(AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'No Active License',
            style: TextStyle(
              color: Color(AppColors.textPrimary),
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Activate a license key to unlock all channels\nand premium features.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(AppColors.textSecondary),
              fontSize: 14,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 32),
          _primaryButton(
            label: 'Activate License',
            icon: Icons.vpn_key_rounded,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const LicenseActivationScreen()),
            ),
          ),
          const SizedBox(height: 14),
          _secondaryButton(
            label: 'View Plans',
            icon: Icons.star_rounded,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PaymentScreen()),
            ),
          ),
          const SizedBox(height: 32),
          _buildFeatureList(),
        ],
      ),
    );
  }

  Widget _buildContent(LicenseModel? license, {required bool isActive}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status hero card
          _buildStatusCard(license, isActive: isActive),
          const SizedBox(height: 20),

          if (license != null) ...[
            // Details card
            _buildDetailsCard(license),
            const SizedBox(height: 20),

            // License key card
            _buildKeyCard(license),
            const SizedBox(height: 24),
          ],

          // Action buttons
          if (!isActive || (license?.remainingDays ?? 999) <= 7) ...[
            _primaryButton(
              label: 'Renew Plan',
              icon: Icons.autorenew_rounded,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PaymentScreen()),
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (!isActive)
            _secondaryButton(
              label: 'Activate New License',
              icon: Icons.vpn_key_rounded,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                    builder: (_) => const LicenseActivationScreen()),
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // ─── Cards ─────────────────────────────────────────────────────────────────

  Widget _buildStatusCard(LicenseModel? license, {required bool isActive}) {
    final remaining = license?.remainingDays ?? 0;
    final isExpiringSoon = isActive && remaining <= 7;

    Color statusColor;
    IconData statusIcon;
    String statusLabel;
    String statusSub;

    if (isActive) {
      statusColor = isExpiringSoon
          ? const Color(AppColors.warning)
          : const Color(AppColors.success);
      statusIcon = isExpiringSoon
          ? Icons.warning_amber_rounded
          : Icons.verified_rounded;
      statusLabel = isExpiringSoon ? 'Expiring Soon' : 'License Active';
      statusSub = isExpiringSoon
          ? '$remaining day${remaining == 1 ? '' : 's'} remaining'
          : '$remaining day${remaining == 1 ? '' : 's'} remaining';
    } else {
      statusColor = const Color(AppColors.error);
      statusIcon = Icons.cancel_rounded;
      statusLabel = license?.isRevoked == true ? 'License Revoked' : 'License Expired';
      statusSub = license?.expiresAt != null
          ? 'Expired on ${_formatDate(license!.expiresAt!)}'
          : 'Your license is no longer active';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            statusColor.withOpacity(0.15),
            statusColor.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: statusColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(statusIcon, color: statusColor, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      statusLabel,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      statusSub,
                      style: const TextStyle(
                        color: Color(AppColors.textSecondary),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (isActive && license != null && license.expiresAt != null) ...[
            const SizedBox(height: 16),
            _progressBar(license),
          ],
          if (isActive && license?.planName != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(AppColors.premiumGold).withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(AppColors.premiumGold).withOpacity(0.3),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.star_rounded,
                      color: Color(AppColors.premiumGold), size: 14),
                  const SizedBox(width: 6),
                  Text(
                    license!.planName!,
                    style: const TextStyle(
                      color: Color(AppColors.premiumGold),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _progressBar(LicenseModel license) {
    final total = license.durationDays ?? 30;
    final remaining = license.remainingDays ?? 0;
    final elapsed = (total - remaining).clamp(0, total);
    final progress = total > 0 ? elapsed / total : 0.0;
    final color = remaining <= 7
        ? const Color(AppColors.warning)
        : const Color(AppColors.success);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Expires ${license.expiresAt != null ? _formatDate(license.expiresAt!) : "–"}',
              style: const TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 12,
              ),
            ),
            Text(
              '$elapsed / $total days used',
              style: const TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress.toDouble(),
            backgroundColor: const Color(AppColors.divider),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
          ),
        ),
      ],
    );
  }

  Widget _buildDetailsCard(LicenseModel license) {
    return _card(
      child: Column(
        children: [
          _detailRow(
            icon: Icons.calendar_today_rounded,
            label: 'Activated On',
            value: license.activatedAt != null
                ? _formatDate(license.activatedAt!)
                : '–',
          ),
          _divider(),
          _detailRow(
            icon: Icons.event_rounded,
            label: 'Expires On',
            value: license.expiresAt != null
                ? _formatDate(license.expiresAt!)
                : '–',
          ),
          _divider(),
          _detailRow(
            icon: Icons.timelapse_rounded,
            label: 'Plan Duration',
            value: license.durationDays != null
                ? '${license.durationDays} days'
                : '–',
          ),
          _divider(),
          _detailRow(
            icon: Icons.devices_rounded,
            label: 'Max Devices',
            value: license.maxDevices != null
                ? '${license.maxDevices} device${license.maxDevices! > 1 ? 's' : ''}'
                : '–',
          ),
        ],
      ),
    );
  }

  Widget _buildKeyCard(LicenseModel license) {
    final key = license.licenseKey;
    final masked = key.length > 8
        ? '${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}'
        : key;

    return _card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'LICENSE KEY',
              style: TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    masked,
                    style: const TextStyle(
                      color: Color(AppColors.textSecondary),
                      fontSize: 14,
                      fontFamily: 'monospace',
                      letterSpacing: 1.5,
                    ),
                  ),
                ),
                InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: key));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('License key copied'),
                        backgroundColor: Color(AppColors.surface),
                        behavior: SnackBarBehavior.floating,
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(AppColors.surfaceLight),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.copy_rounded,
                      size: 16,
                      color: Color(AppColors.textMuted),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureList() {
    final features = [
      (Icons.live_tv_rounded, 'Unlimited live TV channels'),
      (Icons.hd_rounded, 'HD & Full HD streaming'),
      (Icons.speed_rounded, 'Smooth Playback technology'),
      (Icons.devices_rounded, 'Multi-device support'),
      (Icons.update_rounded, 'Always up-to-date channel list'),
    ];

    return _card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'WHAT YOU GET WITH A LICENSE',
              style: TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 14),
            ...features.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(AppColors.primary).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(f.$1,
                            color: const Color(AppColors.primary), size: 16),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        f.$2,
                        style: const TextStyle(
                          color: Color(AppColors.textSecondary),
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(AppColors.surface),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(AppColors.divider), width: 0.8),
      ),
      child: child,
    );
  }

  Widget _detailRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(AppColors.textMuted)),
          const SizedBox(width: 12),
          Text(
            label,
            style: const TextStyle(
              color: Color(AppColors.textSecondary),
              fontSize: 14,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              color: Color(AppColors.textPrimary),
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _divider() => Divider(
        height: 0.5,
        thickness: 0.5,
        color: const Color(AppColors.divider),
        indent: 46,
        endIndent: 16,
      );

  Widget _primaryButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(AppColors.primary),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Widget _secondaryButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(AppColors.textSecondary),
          side: const BorderSide(color: Color(AppColors.divider)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}';
  }
}
