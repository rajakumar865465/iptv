import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium tappable search bar with smooth focus-like tap effect.
class HomeSearchBar extends StatefulWidget {
  final VoidCallback onTap;
  final String hint;

  const HomeSearchBar({
    super.key,
    required this.onTap,
    this.hint = 'Search channels, movies, shows & more...',
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
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        margin: const EdgeInsets.fromLTRB(16, 14, 16, 8),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        decoration: BoxDecoration(
          color: const Color(AppColors.surfaceLight),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: _pressed
                ? const Color(AppColors.primary).withOpacity(0.6)
                : const Color(AppColors.divider).withOpacity(0.65),
            width: _pressed ? 1.2 : 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: _pressed
                  ? const Color(AppColors.primary).withOpacity(0.22)
                  : Colors.black.withOpacity(0.18),
              blurRadius: _pressed ? 16 : 10,
              offset: const Offset(0, 4),
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
                    : const Color(AppColors.textMuted),
                size: 22,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Text(
                widget.hint,
                style: const TextStyle(
                  color: Color(AppColors.textMuted),
                  fontSize: 14.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: const Color(AppColors.surfaceElevated),
                shape: BoxShape.circle,
                border: Border.all(
                  color: const Color(AppColors.divider),
                  width: 0.5,
                ),
              ),
              child: const Icon(
                Icons.tune_rounded,
                color: Color(AppColors.textMuted),
                size: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
