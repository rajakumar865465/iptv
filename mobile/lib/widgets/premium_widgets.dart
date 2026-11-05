import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';

// ─────────────────────────────────────────────────────────────────────────────
// LIVE BADGE — animated red dot + "LIVE" text
// ─────────────────────────────────────────────────────────────────────────────

class LiveBadge extends StatefulWidget {
  final bool small;
  const LiveBadge({super.key, this.small = false});

  @override
  State<LiveBadge> createState() => _LiveBadgeState();
}

class _LiveBadgeState extends State<LiveBadge>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _fade = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final h = widget.small ? 6.0 : 7.5;
    final padH = widget.small ? 5.0 : 7.0;
    final padV = widget.small ? 2.0 : 3.0;
    final fs = widget.small ? 7.5 : 8.5;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.black.withOpacity(0.55)
            : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.12)
              : const Color(0xFFFECACA),
          width: 0.6,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          FadeTransition(
            opacity: _fade,
            child: Container(
              width: h,
              height: h,
              decoration: const BoxDecoration(
                color: Color(0xFFDC2626),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SizedBox(width: widget.small ? 3.5 : 4.5),
          Text(
            'LIVE',
            style: TextStyle(
              fontSize: fs,
              fontWeight: FontWeight.w800,
              color: isDark
                  ? Colors.white.withOpacity(0.95)
                  : const Color(0xFFDC2626),
              letterSpacing: 0.5,
              height: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY BADGE — HD / FHD / 4K chip
// ─────────────────────────────────────────────────────────────────────────────

class QualityBadge extends StatelessWidget {
  final String label;
  const QualityBadge(this.label, {super.key});

  @override
  Widget build(BuildContext context) {
    if (label == 'SD' || label.isEmpty) return const SizedBox.shrink();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final (Color bg, Color border, Color text) = switch (label) {
      '4K' => isDark
          ? (const Color(0xFF7C3AED), Colors.transparent, Colors.white)
          : (const Color(0xFFFAF5FF), const Color(0xFFE9D5FF), const Color(0xFF7E22CE)),
      'FHD' => isDark
          ? (const Color(0xFF0EA5E9), Colors.transparent, Colors.white)
          : (const Color(0xFFF0FDF4), const Color(0xFFBBF7D0), const Color(0xFF15803D)),
      'HD' => isDark
          ? (const Color(0xFF1D4ED8), Colors.transparent, Colors.white)
          : (const Color(0xFFEFF6FF), const Color(0xFFBFDBFE), const Color(0xFF1D4ED8)),
      _ => isDark
          ? (const Color(0xFF374151), Colors.transparent, Colors.white)
          : (const Color(0xFFF1F5F9), const Color(0xFFCBD5E1), const Color(0xFF334155)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: border, width: 0.6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w800,
          color: text,
          letterSpacing: 0.4,
          height: 1.0,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — title + optional icon + "See All"
// ─────────────────────────────────────────────────────────────────────────────

class SectionHeader extends StatelessWidget {
  final String title;
  final IconData? icon;
  final Color? iconColor;
  final VoidCallback? onSeeAll;
  final EdgeInsetsGeometry padding;

  const SectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.iconColor,
    this.onSeeAll,
    this.padding = const EdgeInsets.fromLTRB(20, 22, 12, 10),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: (iconColor ?? const Color(AppColors.primary)).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Icon(
                      icon,
                      color: iconColor ?? const Color(AppColors.primary),
                      size: 15,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    title,
                    style: TextStyle(
                      color: AppColors.text1(context),
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          if (onSeeAll != null)
            GestureDetector(
              onTap: onSeeAll,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(AppColors.primary).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(AppColors.primary).withOpacity(0.25),
                    width: 0.5,
                  ),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Text(
                    'See All',
                    style: TextStyle(
                      color: Color(AppColors.primary),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 14,
                    color: Color(AppColors.primary),
                  ),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CHIP — filter pill for categories / languages
// ─────────────────────────────────────────────────────────────────────────────

class CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  const CategoryChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
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
          padding: EdgeInsets.symmetric(
            horizontal: icon != null ? 12 : 14,
            vertical: 8,
          ),
          decoration: BoxDecoration(
            color: selected
                ? const Color(AppColors.primary)
                : AppColors.surfElevated(context),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: selected
                  ? const Color(AppColors.primary)
                  : AppColors.div(context),
              width: 1,
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: const Color(AppColors.primary).withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    )
                  ]
                : null,
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 13,
                color: selected
                    ? Colors.white
                    : AppColors.text2(context),
              ),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? Colors.white
                    : AppColors.text1(context),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM SEARCH BAR — tappable / interactive
// ─────────────────────────────────────────────────────────────────────────────

class PremiumSearchBar extends StatelessWidget {
  final String hint;
  final VoidCallback? onTap;
  final bool readOnly;

  const PremiumSearchBar({
    super.key,
    this.hint = 'Search channels, movies, shows...',
    this.onTap,
    this.readOnly = true,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: AppColors.surf(context),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.div(context), width: 1),
        ),
        child: Row(children: [
          Icon(
            Icons.search_rounded,
            color: AppColors.textM(context),
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              hint,
              style: TextStyle(
                color: AppColors.textM(context),
                fontSize: 14,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfElevated(context),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.div(context), width: 0.8),
            ),
            child: Icon(
              Icons.tune_rounded,
              color: AppColors.text2(context),
              size: 15,
            ),
          ),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE WIDGET — illustrated empty/error state
// ─────────────────────────────────────────────────────────────────────────────

class EmptyStateWidget extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Color? iconColor;

  const EmptyStateWidget({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Glow container for icon
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: (iconColor ?? const Color(AppColors.primary)).withOpacity(0.08),
                border: Border.all(
                  color: (iconColor ?? const Color(AppColors.primary)).withOpacity(0.15),
                  width: 1,
                ),
              ),
              child: Icon(
                icon,
                size: 36,
                color: (iconColor ?? const Color(AppColors.primary)).withOpacity(0.5),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: TextStyle(
                color: AppColors.text1(context),
                fontSize: 17,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: TextStyle(
                color: AppColors.textM(context),
                fontSize: 13,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 28),
              SizedBox(
                width: 160,
                child: ElevatedButton(
                  onPressed: onAction,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(AppColors.primary),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  child: Text(actionLabel!),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON — shimmer placeholder blocks
// ─────────────────────────────────────────────────────────────────────────────

class LoadingSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const LoadingSkeleton({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.shimmerBaseColor(context),
      highlightColor: AppColors.shimmerHighlightColor(context),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.surf(context),
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

class SkeletonChannelCard extends StatelessWidget {
  const SkeletonChannelCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surf(context),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.div(context), width: 0.8),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
        child: Shimmer.fromColors(
          baseColor: AppColors.shimmerBaseColor(context),
          highlightColor: AppColors.shimmerHighlightColor(context),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    height: 14,
                    width: 24,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  Container(
                    height: 20,
                    width: 20,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              Column(
                children: [
                  Container(
                    height: 10,
                    width: 68,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Container(
                    height: 8,
                    width: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE MENU TILE — used in ProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

class ProfileMenuTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool isDanger;
  final Widget? trailing;
  final Color? iconBg;

  const ProfileMenuTile({
    super.key,
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.isDanger = false,
    this.trailing,
    this.iconBg,
  });

  @override
  Widget build(BuildContext context) {
    final Color mainColor =
        isDanger ? const Color(AppColors.brandRed) : AppColors.text1(context);
    final Color bgColor =
        iconBg ?? (isDanger ? const Color(AppColors.brandRed) : const Color(AppColors.primary));

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          leading: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: bgColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: bgColor, size: 19),
          ),
          title: Text(
            label,
            style: TextStyle(
              color: mainColor,
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: subtitle != null
              ? Text(
                  subtitle!,
                  style: TextStyle(
                    color: AppColors.textM(context),
                    fontSize: 12,
                  ),
                )
              : null,
          trailing: trailing ??
              Icon(
                Icons.chevron_right_rounded,
                color: isDanger
                    ? const Color(AppColors.brandRed).withOpacity(0.5)
                    : AppColors.textM(context),
                size: 18,
              ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BANNER — soft inline error bar
// ─────────────────────────────────────────────────────────────────────────────

class ErrorBanner extends StatelessWidget {
  final String message;

  const ErrorBanner(this.message, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(AppColors.brandRed).withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: const Color(AppColors.brandRed).withOpacity(0.2),
          width: 0.5,
        ),
      ),
      child: Row(children: [
        const Icon(
          Icons.wifi_off_rounded,
          size: 15,
          color: Color(AppColors.brandRed),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: TextStyle(
              color: AppColors.text2(context),
              fontSize: 12,
            ),
          ),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
