import 'package:flutter/material.dart';
import '../../constants.dart';
import '../premium_widgets.dart';

/// Professional empty state shown when no channels are available.
class HomeEmptyState extends StatelessWidget {
  final VoidCallback? onBrowse;
  final VoidCallback? onRefresh;

  const HomeEmptyState({
    super.key,
    this.onBrowse,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
            decoration: BoxDecoration(
              color: const Color(AppColors.surface),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: const Color(AppColors.divider),
                width: 0.8,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: EmptyStateWidget(
              icon: Icons.tv_off_rounded,
              title: 'No channels available right now',
              subtitle: 'Please try again later. Pull down to refresh or browse Live TV.',
              actionLabel: 'Browse Live TV',
              onAction: onBrowse,
              iconColor: const Color(AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 16),
          if (onRefresh != null)
            Center(
              child: OutlinedButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Refresh'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(AppColors.textSecondary),
                  side: const BorderSide(color: Color(AppColors.divider)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
