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
      padding: const EdgeInsets.fromLTRB(14, 2, 14, 6),
      child: GestureDetector(
        onTap: () => onChanged(!value),
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: value
                ? const Color(AppColors.success).withOpacity(0.08)
                : const Color(AppColors.surface),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: value
                  ? const Color(AppColors.success).withOpacity(0.3)
                  : const Color(AppColors.divider),
              width: 0.8,
            ),
          ),
          child: Row(
            children: [
              Icon(
                value ? Icons.signal_cellular_alt_rounded : Icons.signal_cellular_off_rounded,
                size: 15,
                color: value
                    ? const Color(AppColors.success)
                    : const Color(AppColors.textMuted),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Working channels only',
                  style: TextStyle(
                    color: value
                        ? const Color(AppColors.success)
                        : const Color(AppColors.textSecondary),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
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
      ),
    );
  }
}
