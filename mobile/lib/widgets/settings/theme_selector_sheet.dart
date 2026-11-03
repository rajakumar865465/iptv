import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../constants.dart';
import '../../cubits/theme_cubit.dart';

/// Modal bottom sheet allowing users to choose Dark, Light, or System theme.
class ThemeSelectorSheet extends StatelessWidget {
  const ThemeSelectorSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const ThemeSelectorSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentMode = context.watch<ThemeCubit>().state;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(AppColors.surfaceElevated) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(
          color: isDark ? const Color(AppColors.divider) : const Color(0xFFE2E8F0),
          width: 0.8,
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: (isDark ? Colors.white : Colors.black).withOpacity(0.18),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(AppColors.primary).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.palette_rounded,
                    size: 19,
                    color: Color(AppColors.primary),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Choose Appearance',
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Select how NivaTV looks on your device',
                        style: TextStyle(
                          color: isDark
                              ? const Color(AppColors.textMuted)
                              : const Color(0xFF64748B),
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            _ThemeOptionTile(
              title: 'Dark Mode',
              subtitle: 'OLED obsidian background, easy on the eyes',
              icon: Icons.dark_mode_rounded,
              iconColor: const Color(AppColors.primary),
              isSelected: currentMode == ThemeMode.dark,
              onTap: () {
                context.read<ThemeCubit>().setTheme(ThemeMode.dark);
                Navigator.of(context).pop();
              },
            ),
            const SizedBox(height: 10),

            _ThemeOptionTile(
              title: 'Light Mode',
              subtitle: 'Clean high contrast, great for daytime viewing',
              icon: Icons.light_mode_rounded,
              iconColor: const Color(0xFFF59E0B),
              isSelected: currentMode == ThemeMode.light,
              onTap: () {
                context.read<ThemeCubit>().setTheme(ThemeMode.light);
                Navigator.of(context).pop();
              },
            ),
            const SizedBox(height: 10),

            _ThemeOptionTile(
              title: 'System Default',
              subtitle: 'Automatically adapts to device appearance',
              icon: Icons.brightness_auto_rounded,
              iconColor: const Color(0xFF0EA5E9),
              isSelected: currentMode == ThemeMode.system,
              onTap: () {
                context.read<ThemeCubit>().setTheme(ThemeMode.system);
                Navigator.of(context).pop();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ThemeOptionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final bool isSelected;
  final VoidCallback onTap;

  const _ThemeOptionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(AppColors.primary).withOpacity(isDark ? 0.15 : 0.08)
              : (isDark ? const Color(AppColors.surface) : const Color(0xFFF8FAFC)),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? const Color(AppColors.primary)
                : (isDark ? const Color(AppColors.divider) : const Color(0xFFE2E8F0)),
            width: isSelected ? 1.5 : 0.8,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                      fontSize: 14.5,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: isDark
                          ? const Color(AppColors.textMuted)
                          : const Color(0xFF64748B),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? const Color(AppColors.primary) : Colors.transparent,
                border: Border.all(
                  color: isSelected
                      ? const Color(AppColors.primary)
                      : (isDark ? const Color(AppColors.divider) : const Color(0xFFCBD5E1)),
                  width: 1.5,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check_rounded, color: Colors.white, size: 14)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
