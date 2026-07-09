import 'package:flutter/material.dart';
import '../../constants.dart';

/// Compact modern switch row for the Working Only filter.
class WorkingOnlyToggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const WorkingOnlyToggle({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 2, 14, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(AppColors.divider),
            width: 0.8,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: value
                    ? const Color(AppColors.success).withOpacity(0.12)
                    : const Color(AppColors.surfaceLight),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                value ? Icons.signal_cellular_alt_rounded : Icons.signal_cellular_off_rounded,
                size: 18,
                color: value
                    ? const Color(AppColors.success)
                    : const Color(AppColors.textMuted),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Working channels only',
                    style: TextStyle(
                      color: Color(AppColors.textPrimary),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Hide unstable sources',
                    style: TextStyle(
                      color: const Color(AppColors.textMuted),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeColor: Colors.white,
              activeTrackColor: const Color(AppColors.success),
              inactiveThumbColor: Colors.white,
              inactiveTrackColor: const Color(AppColors.surfaceLight),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
            ),
          ],
        ),
      ),
    );
  }
}
