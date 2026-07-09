import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium Live TV app bar with title, channel count, sort dropdown and
/// optional filter action.
class LiveTvAppBar extends StatelessWidget {
  final int channelCount;
  final String selectedSort;
  final List<(String value, String label, IconData icon)> sortOptions;
  final ValueChanged<String> onSortChanged;
  final VoidCallback? onFilterTap;

  const LiveTvAppBar({
    super.key,
    required this.channelCount,
    required this.selectedSort,
    required this.sortOptions,
    required this.onSortChanged,
    this.onFilterTap,
  });

  String get _currentLabel {
    for (final o in sortOptions) {
      if (o.$1 == selectedSort) return o.$2;
    }
    return 'Recommended';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Live TV',
                  style: TextStyle(
                    color: Color(AppColors.textPrimary),
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$channelCount channels available',
                  style: const TextStyle(
                    color: Color(AppColors.textMuted),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
          // Sort dropdown
          _SortButton(
            currentLabel: _currentLabel,
            options: sortOptions,
            current: selectedSort,
            onChanged: onSortChanged,
          ),
          const SizedBox(width: 8),
          // Filter action
          if (onFilterTap != null)
            GestureDetector(
              onTap: onFilterTap,
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(AppColors.surfaceLight),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(AppColors.divider),
                    width: 0.8,
                  ),
                ),
                child: const Icon(
                  Icons.tune_rounded,
                  color: Color(AppColors.textSecondary),
                  size: 18,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SortButton extends StatelessWidget {
  final String currentLabel;
  final String current;
  final List<(String value, String label, IconData icon)> options;
  final ValueChanged<String> onChanged;

  const _SortButton({
    required this.currentLabel,
    required this.current,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showSheet(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(AppColors.surfaceLight),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(AppColors.divider),
            width: 0.8,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.sort_rounded,
              size: 15,
              color: Color(AppColors.textSecondary),
            ),
            const SizedBox(width: 5),
            Text(
              currentLabel,
              style: const TextStyle(
                color: Color(AppColors.textSecondary),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 3),
            const Icon(
              Icons.expand_more_rounded,
              size: 14,
              color: Color(AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  void _showSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _SortSheet(
        options: options,
        current: current,
        onChanged: (s) {
          Navigator.pop(context);
          onChanged(s);
        },
      ),
    );
  }
}

class _SortSheet extends StatelessWidget {
  final List<(String value, String label, IconData icon)> options;
  final String current;
  final ValueChanged<String> onChanged;

  const _SortSheet({
    required this.options,
    required this.current,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(AppColors.surfaceElevated),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(AppColors.divider),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Sort Channels',
                style: TextStyle(
                  color: Color(AppColors.textPrimary),
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          ...options.map((o) {
            final isSelected = o.$1 == current;
            return InkWell(
              onTap: () => onChanged(o.$1),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(AppColors.primary).withOpacity(0.15)
                            : const Color(AppColors.surfaceLight),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(
                        o.$3,
                        size: 18,
                        color: isSelected
                            ? const Color(AppColors.primary)
                            : const Color(AppColors.textSecondary),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        o.$2,
                        style: TextStyle(
                          color: isSelected
                              ? const Color(AppColors.primary)
                              : const Color(AppColors.textPrimary),
                          fontSize: 14.5,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                        ),
                      ),
                    ),
                    if (isSelected)
                      const Icon(
                        Icons.check_circle_rounded,
                        color: Color(AppColors.primary),
                        size: 20,
                      ),
                  ],
                ),
              ),
            );
          }),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
        ],
      ),
    );
  }
}
