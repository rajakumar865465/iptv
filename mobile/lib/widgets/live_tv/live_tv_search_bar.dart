import 'package:flutter/material.dart';
import '../../constants.dart';

/// Rounded premium search bar with clear button.
class LiveTvSearchBar extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String hint;

  const LiveTvSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
    this.hint = 'Search live channels...',
  });

  @override
  State<LiveTvSearchBar> createState() => _LiveTvSearchBarState();
}

class _LiveTvSearchBarState extends State<LiveTvSearchBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _hasText = widget.controller.text.isNotEmpty;
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    final hasText = widget.controller.text.isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
  }

  void _clear() {
    widget.controller.clear();
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      child: TextField(
        controller: widget.controller,
        style: const TextStyle(
          color: Color(AppColors.textPrimary),
          fontSize: 14.5,
          fontWeight: FontWeight.w500,
        ),
        textInputAction: TextInputAction.search,
        cursorColor: const Color(AppColors.primary),
        decoration: InputDecoration(
          filled: true,
          fillColor: const Color(AppColors.surfaceLight),
          hintText: widget.hint,
          hintStyle: const TextStyle(
            color: Color(AppColors.textMuted),
            fontSize: 14.5,
            fontWeight: FontWeight.w500,
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
          prefixIcon: const Padding(
            padding: EdgeInsets.only(left: 16, right: 10),
            child: Icon(
              Icons.search_rounded,
              color: Color(AppColors.textMuted),
              size: 22,
            ),
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          suffixIcon: _hasText
              ? GestureDetector(
                  onTap: _clear,
                  child: Container(
                    margin: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(
                      color: Color(AppColors.surfaceElevated),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      color: Color(AppColors.textSecondary),
                      size: 16,
                    ),
                  ),
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(
              color: const Color(AppColors.divider).withOpacity(0.65),
              width: 0.8,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(
              color: const Color(AppColors.divider).withOpacity(0.65),
              width: 0.8,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(
              color: Color(AppColors.primary),
              width: 1.2,
            ),
          ),
        ),
        onChanged: widget.onChanged,
      ),
    );
  }
}
