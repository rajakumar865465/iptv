import 'package:flutter/material.dart';
import '../../constants.dart';

/// Unified compact status & "Working Only" filter bar for Live TV.
/// Combines the channel count indicator, active-filter clear button, and
/// working-only pill toggle into a single sleek 38px row.
class WorkingOnlyToggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final int? channelCount;
  final bool showClearFilters;
  final VoidCallback? onClearFilters;

  const WorkingOnlyToggle({
    super.key,
    required this.value,
    required this.onChanged,
    this.channelCount,
    this.showClearFilters = false,
    this.onClearFilters,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = value
        ? const Color(AppColors.success)
        : const Color(AppColors.warning);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
      child: Row(
        children: [
          // Left: Live count indicator
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: statusColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: statusColor.withOpacity(0.5),
                  blurRadius: 6,
                ),
              ],
            ),
          ),
          const SizedBox(width: 7),
          if (channelCount != null)
            Flexible(
              child: Text(
                '$channelCount ${value ? 'online' : 'channels'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.text2(context),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (showClearFilters && onClearFilters != null) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onClearFilters,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                decoration: BoxDecoration(
                  color: const Color(AppColors.brandRed).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(AppColors.brandRed).withOpacity(0.28),
                    width: 0.8,
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.close_rounded,
                      size: 11,
                      color: Color(AppColors.brandRed),
                    ),
                    SizedBox(width: 3),
                    Text(
                      'Reset',
                      style: TextStyle(
                        color: Color(AppColors.brandRed),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const Spacer(),
          // Right: Compact interactive pill switch
          GestureDetector(
            onTap: () => onChanged(!value),
            behavior: HitTestBehavior.opaque,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.fromLTRB(10, 5, 6, 5),
              decoration: BoxDecoration(
                color: value
                    ? const Color(AppColors.success).withOpacity(0.12)
                    : AppColors.surf(context),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: value
                      ? const Color(AppColors.success).withOpacity(0.35)
                      : AppColors.div(context),
                  width: 0.9,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    value
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    size: 13,
                    color: value
                        ? const Color(AppColors.success)
                        : AppColors.textM(context),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'Working only',
                    style: TextStyle(
                      color: value
                          ? const Color(AppColors.success)
                          : AppColors.text2(context),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
