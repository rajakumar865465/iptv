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
    if (name.isEmpty) return '$greeting, Welcome Back';
    return '$greeting, $name';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'NIVATV',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '👋 $_displayGreeting',
                  style: const TextStyle(
                    color: Color(AppColors.textSecondary),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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

class _BrandMark extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(AppColors.primary),
            Color(AppColors.brandRed),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(AppColors.primary).withOpacity(0.35),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: const Icon(
        Icons.live_tv_rounded,
        color: Colors.white,
        size: 18,
      ),
    );
  }
}

class _PremiumBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFCA28),
            Color(0xFFFF8F00),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(AppColors.premiumGold).withOpacity(0.45),
            blurRadius: 12,
            spreadRadius: 0,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.workspace_premium_rounded,
            color: Colors.black,
            size: 14,
          ),
          SizedBox(width: 5),
          Text(
            'Premium',
            style: TextStyle(
              color: Colors.black,
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _UpgradeButton extends StatelessWidget {
  final VoidCallback? onTap;
  const _UpgradeButton({this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(AppColors.primary),
              Color(0xFF2563EB),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(AppColors.primary).withOpacity(0.35),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.diamond_rounded,
              color: Colors.white,
              size: 13,
            ),
            SizedBox(width: 5),
            Text(
              'Upgrade',
              style: TextStyle(
                color: Colors.white,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: const Color(AppColors.surfaceLight),
          shape: BoxShape.circle,
          border: Border.all(
            color: const Color(AppColors.divider),
            width: 0.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Icon(
              Icons.notifications_outlined,
              color: Color(AppColors.textSecondary),
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
