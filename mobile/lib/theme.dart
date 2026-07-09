import 'package:flutter/material.dart';
import 'constants.dart';

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: 'Roboto',
      scaffoldBackgroundColor: const Color(AppColors.background),
      colorScheme: const ColorScheme.dark(
        primary: Color(AppColors.primary),
        secondary: Color(AppColors.brandRed),
        tertiary: Color(AppColors.premiumGold),
        surface: Color(AppColors.surface),
        onSurface: Color(AppColors.textPrimary),
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        error: Color(AppColors.error),
        outline: Color(AppColors.divider),
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          color: Color(AppColors.textPrimary),
          letterSpacing: -0.5,
        ),
        headlineLarge: TextStyle(
          fontSize: 26,
          fontWeight: FontWeight.w800,
          color: Color(AppColors.textPrimary),
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: Color(AppColors.textPrimary),
          letterSpacing: -0.3,
        ),
        titleLarge: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: Color(AppColors.textPrimary),
          letterSpacing: -0.2,
        ),
        titleMedium: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: Color(AppColors.textPrimary),
        ),
        titleSmall: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Color(AppColors.textPrimary),
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          color: Color(AppColors.textPrimary),
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: Color(AppColors.textSecondary),
        ),
        bodySmall: TextStyle(
          fontSize: 11,
          color: Color(AppColors.textMuted),
        ),
        labelLarge: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
        labelSmall: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: const Color(AppColors.surface),
        elevation: 0,
        shadowColor: Colors.black54,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(AppColors.divider), width: 0.5),
        ),
        margin: EdgeInsets.zero,
      ),
      // Material3 NavigationBar styling
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: const Color(AppColors.navBackground),
        indicatorColor: const Color(AppColors.primary).withOpacity(0.18),
        indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        height: 68,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final isSelected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
            color: isSelected
                ? const Color(AppColors.primary)
                : const Color(AppColors.textMuted),
            letterSpacing: 0.1,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          return IconThemeData(
            size: states.contains(WidgetState.selected) ? 24 : 22,
            color: states.contains(WidgetState.selected)
                ? const Color(AppColors.primary)
                : const Color(AppColors.textMuted),
          );
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(AppColors.surfaceLight),
        hoverColor: Colors.transparent,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(AppColors.divider), width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(AppColors.divider), width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(AppColors.primary), width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(AppColors.error), width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: Color(AppColors.textMuted), fontSize: 14),
        prefixIconColor: const Color(AppColors.textMuted),
        suffixIconColor: const Color(AppColors.textSecondary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(AppColors.primary),
          foregroundColor: Colors.white,
          minimumSize: const Size(88, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2),
          elevation: 0,
          shadowColor: Colors.transparent,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(AppColors.primary),
          side: const BorderSide(color: Color(AppColors.primary), width: 1.5),
          minimumSize: const Size(88, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: const Color(AppColors.primary),
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(AppColors.surfaceLight),
        selectedColor: const Color(AppColors.primary),
        side: const BorderSide(color: Color(AppColors.divider), width: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      dividerTheme: const DividerThemeData(
        color: Color(AppColors.divider),
        thickness: 0.5,
        space: 0,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(AppColors.background),
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Color(AppColors.textPrimary),
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: Color(AppColors.textSecondary)),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? const Color(AppColors.primary) : Colors.white54),
        trackColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected)
                ? const Color(AppColors.primary).withOpacity(0.4)
                : const Color(AppColors.surfaceLight)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Color(AppColors.surfaceElevated),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        showDragHandle: false,
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: Color(AppColors.textSecondary),
        textColor: Color(AppColors.textPrimary),
        minLeadingWidth: 20,
        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      ),
      splashColor: const Color(AppColors.primary).withOpacity(0.08),
      highlightColor: Colors.transparent,
      splashFactory: InkRipple.splashFactory,
    );
  }
}
