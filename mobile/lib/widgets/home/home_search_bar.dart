import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium tappable search bar with smooth focus-like tap effect.
class HomeSearchBar extends StatefulWidget {
  final VoidCallback onTap;
  final String hint;

  const HomeSearchBar({
    super.key,
    required this.onTap,
    this.hint = 'Search channels, movies & more...',
  });

  @override
  State<HomeSearchBar> createState() => _HomeSearchBarState();
}

class _HomeSearchBarState extends State<HomeSearchBar> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: widget.onTap,
              onTapDown: (_) => _setPressed(true),
              onTapUp: (_) => _setPressed(false),
              onTapCancel: () => _setPressed(false),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.surf(context),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: _pressed
                        ? const Color(AppColors.primary).withOpacity(0.6)
                        : AppColors.div(context).withOpacity(0.85),
                    width: _pressed ? 1.2 : 0.8,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _pressed
                          ? const Color(AppColors.primary).withOpacity(0.15)
                          : Colors.black.withOpacity(isDark ? 0.15 : 0.04),
                      blurRadius: _pressed ? 12 : 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      child: Icon(
                        Icons.search_rounded,
                        color: _pressed
                            ? const Color(AppColors.primary)
                            : AppColors.textM(context),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        widget.hint,
                        style: TextStyle(
                          color: AppColors.textM(context),
                          fontSize: 14.5,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: widget.onTap, // Can trigger search/filter modal
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfElevated(context),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.div(context),
                  width: 0.8,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDark ? 0.15 : 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(
                Icons.tune_rounded,
                color: AppColors.text1(context),
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
