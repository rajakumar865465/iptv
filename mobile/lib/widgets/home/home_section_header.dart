import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium section header with accent line, icon, title and See All action.
class HomeSectionHeader extends StatelessWidget {
  final String title;
  final IconData? icon;
  final Color? accentColor;
  final VoidCallback? onSeeAll;

  const HomeSectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.accentColor,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    final color = accentColor ?? const Color(AppColors.primary);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 16, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Accent line
          Container(
            width: 3.5,
            height: 20,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  color,
                  color.withOpacity(0.45),
                ],
              ),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          // Optional icon
          if (icon != null) ...[
            Icon(
              icon,
              color: color,
              size: 20,
            ),
            const SizedBox(width: 8),
          ],
          // Title
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: Color(AppColors.textPrimary),
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                height: 1.1,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // See All
          if (onSeeAll != null)
            GestureDetector(
              onTap: onSeeAll,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'See all',
                      style: TextStyle(
                        color: const Color(AppColors.textSecondary).withOpacity(0.8),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 2),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 14,
                      color: const Color(AppColors.textSecondary).withOpacity(0.8),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
