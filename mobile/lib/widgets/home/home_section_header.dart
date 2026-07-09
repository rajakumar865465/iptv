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
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                icon,
                color: color,
                size: 15,
              ),
            ),
            const SizedBox(width: 10),
          ],
          // Title
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: Color(AppColors.textPrimary),
                fontSize: 17,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.4,
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
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(AppColors.primary).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(AppColors.primary).withOpacity(0.25),
                    width: 0.8,
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'See All',
                      style: TextStyle(
                        color: Color(AppColors.primary),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(width: 2),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 14,
                      color: Color(AppColors.primary),
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
