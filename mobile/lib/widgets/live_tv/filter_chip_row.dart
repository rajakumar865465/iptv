import 'package:flutter/material.dart';
import '../../constants.dart';

/// Data class for a single filter chip.
class FilterChipItem<T> {
  final T? value;
  final String label;
  final int? count;
  final bool selected;

  const FilterChipItem({
    required this.value,
    required this.label,
    this.count,
    required this.selected,
  });
}

/// Horizontal scrollable premium filter chips.
class FilterChipRow<T> extends StatelessWidget {
  final List<FilterChipItem<T>> items;
  final ValueChanged<T?> onSelected;
  final double height;

  const FilterChipRow({
    super.key,
    required this.items,
    required this.onSelected,
    this.height = 40,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          return _Chip(
            item: item,
            onTap: () => onSelected(item.selected ? null : item.value),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final FilterChipItem item;
  final VoidCallback onTap;

  const _Chip({
    required this.item,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            gradient: item.selected
                ? const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(AppColors.primary),
                      Color(0xFF2563EB),
                    ],
                  )
                : null,
            color: item.selected ? null : const Color(AppColors.surfaceLight),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: item.selected
                  ? Colors.transparent
                  : const Color(AppColors.divider),
              width: 0.8,
            ),
            boxShadow: item.selected
                ? [
                    BoxShadow(
                      color: const Color(AppColors.primary).withOpacity(0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                item.label,
                style: TextStyle(
                  color: item.selected
                      ? Colors.white
                      : const Color(AppColors.textSecondary),
                  fontSize: 12.5,
                  fontWeight: item.selected ? FontWeight.w700 : FontWeight.w500,
                  letterSpacing: -0.1,
                ),
              ),
              if (item.count != null && item.count! > 0) ...[
                const SizedBox(width: 5),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: item.selected
                        ? Colors.white.withOpacity(0.2)
                        : const Color(AppColors.surface),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${item.count}',
                    style: TextStyle(
                      color: item.selected
                          ? Colors.white.withOpacity(0.95)
                          : const Color(AppColors.textMuted),
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
