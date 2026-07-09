import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium profile menu tile with icon background, title, subtitle, chevron
/// and press animation.
class ProfileMenuTile extends StatefulWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final Color? iconColor;
  final bool isDanger;
  final Widget? trailing;

  const ProfileMenuTile({
    super.key,
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.iconColor,
    this.isDanger = false,
    this.trailing,
  });

  @override
  State<ProfileMenuTile> createState() => _ProfileMenuTileState();
}

class _ProfileMenuTileState extends State<ProfileMenuTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final mainColor = widget.isDanger
        ? const Color(AppColors.brandRed)
        : (widget.iconColor ?? const Color(AppColors.primary));
    final textColor = widget.isDanger
        ? const Color(AppColors.textPrimary)
        : const Color(AppColors.textPrimary);

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      behavior: HitTestBehavior.translucent,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOut,
        color: _pressed
            ? mainColor.withOpacity(0.06)
            : Colors.transparent,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: mainColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: mainColor.withOpacity(0.18),
                    width: 0.8,
                  ),
                ),
                child: Icon(
                  widget.icon,
                  color: mainColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.label,
                      style: TextStyle(
                        color: textColor,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (widget.subtitle != null && widget.subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        widget.subtitle!,
                        style: const TextStyle(
                          color: Color(AppColors.textMuted),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          height: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              widget.trailing ??
                  Icon(
                    Icons.chevron_right_rounded,
                    color: widget.isDanger
                        ? const Color(AppColors.brandRed).withOpacity(0.5)
                        : const Color(AppColors.textMuted),
                    size: 20,
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
