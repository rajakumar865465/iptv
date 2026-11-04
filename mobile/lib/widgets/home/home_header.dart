import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium home header with brand mark, greeting, premium badge and
/// notification action.
class HomeHeader extends StatelessWidget {
  final String greeting;
  final String? userName;
  final bool isPremium;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onPremiumTap;
  final bool hasUnreadNotifications;

  const HomeHeader({
    super.key,
    required this.greeting,
    this.userName,
    required this.isPremium,
    this.onNotificationTap,
    this.onPremiumTap,
    this.hasUnreadNotifications = false,
  });

  String get _displayGreeting {
    final name = userName?.trim() ?? '';
    if (name.isEmpty) return '$greeting 👋';
    final cleanName = name.replaceAll(RegExp(r'\d+'), '').trim();
    final displayName = cleanName.isNotEmpty ? cleanName : name;
    final capitalized = displayName.isNotEmpty
        ? displayName[0].toUpperCase() + displayName.substring(1)
        : 'Viewer';
    return '$greeting, $capitalized 👋';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: TextStyle(
                          color: AppColors.text1(context),
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                        children: const [
                          TextSpan(text: 'NIVA'),
                          TextSpan(
                            text: 'TV',
                            style: TextStyle(color: Color(AppColors.brandRed)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(AppColors.primary).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'LIVE',
                        style: TextStyle(
                          color: Color(AppColors.primaryLight),
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  _displayGreeting,
                  style: TextStyle(
                    color: AppColors.text1(context),
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 1),
                Text(
                  'What would you like to watch today?',
                  style: TextStyle(
                    color: AppColors.textM(context),
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
          _NotificationButton(
            onTap: onNotificationTap,
            hasUnread: hasUnreadNotifications,
          ),
        ],
      ),
    );
  }
}

class _NotificationButton extends StatelessWidget {
  final VoidCallback? onTap;
  final bool hasUnread;
  const _NotificationButton({this.onTap, this.hasUnread = false});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.surfElevated(context),
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.div(context),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.25 : 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(
              Icons.notifications_outlined,
              color: AppColors.text1(context),
              size: 21,
            ),
            if (hasUnread)
              Positioned(
                top: 9,
                right: 9,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: const Color(AppColors.brandRed),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(AppColors.surfaceLight),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(AppColors.brandRed).withOpacity(0.5),
                        blurRadius: 5,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
