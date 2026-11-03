import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_displaymode/flutter_displaymode.dart';
import '../constants.dart';
import '../cubits/theme_cubit.dart';
import '../services/storage_service.dart';

class PlaybackSettingsScreen extends StatefulWidget {
  const PlaybackSettingsScreen({super.key});

  @override
  State<PlaybackSettingsScreen> createState() => _PlaybackSettingsScreenState();
}

class _PlaybackSettingsScreenState extends State<PlaybackSettingsScreen> {
  final StorageService _storage = StorageService();

  String _defaultQuality = 'auto';
  bool _dataSaverEnabled = false;
  bool _autoMobileData = true;
  bool _hdOnlyWifi = true;
  
  String _displayRefreshRate = 'auto';
  bool _matchVideoFrameRate = true;
  bool _supports120Hz = false;
  bool _supports90Hz = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final defaultQuality = await _storage.getVideoQualityPreference();
    final dataSaver = await _storage.isDataSaverEnabled();
    final autoMobile = await _storage.isAutoQualityOnMobileData();
    final hdOnlyWifi = await _storage.isHdOnlyOnWifi();
    final displayRate = await _storage.getDisplayRefreshRate();
    final matchVideoRate = await _storage.getMatchVideoFrameRate();
    
    bool supports120 = false;
    bool supports90 = false;
    if (!kIsWeb && Platform.isAndroid) {
      try {
        final modes = await FlutterDisplayMode.supported;
        for (var mode in modes) {
          if (mode.refreshRate > 119) supports120 = true;
          if (mode.refreshRate > 89 && mode.refreshRate < 100) supports90 = true;
        }
      } catch (_) {}
    }

    if (mounted) {
      setState(() {
        _defaultQuality = defaultQuality;
        _dataSaverEnabled = dataSaver;
        _autoMobileData = autoMobile;
        _hdOnlyWifi = hdOnlyWifi;
        _displayRefreshRate = displayRate;
        _matchVideoFrameRate = matchVideoRate;
        _supports120Hz = supports120;
        _supports90Hz = supports90;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final themeCubit = context.watch<ThemeCubit>();
    final currentThemeMode = themeCubit.state;

    return Scaffold(
      backgroundColor: AppColors.bg(context),
      appBar: AppBar(
        backgroundColor: AppColors.bg(context),
        title: Text(
          'Settings',
          style: TextStyle(
            color: AppColors.text1(context),
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        iconTheme: IconThemeData(color: AppColors.text1(context)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, AppConstants.bottomNavClearance),
        children: [
          // ── APPEARANCE SECTION ──────────────────────────────────────────
          _buildSectionHeader('APPEARANCE'),
          const SizedBox(height: 12),
          _buildThemeSelector(currentThemeMode, isDark),
          Divider(color: AppColors.div(context), height: 32),

          // ── VIDEO QUALITY SECTION ────────────────────────────────────────
          _buildSectionHeader('VIDEO QUALITY'),
          const SizedBox(height: 14),
          _buildDropdownItem(
            title: 'Default Video Quality',
            subtitle: 'Preferred starting quality for streams',
            value: _defaultQuality,
            items: [
              const DropdownMenuItem(value: 'auto', child: Text('Auto - Recommended')),
              const DropdownMenuItem(value: 'data_saver', child: Text('Data Saver')),
              const DropdownMenuItem(value: '1080p', child: Text('1080p - Full HD')),
              const DropdownMenuItem(value: '720p', child: Text('720p - HD')),
              const DropdownMenuItem(value: '480p', child: Text('480p - Standard')),
              const DropdownMenuItem(value: '360p', child: Text('360p - Medium Low')),
              const DropdownMenuItem(value: '240p', child: Text('240p - Low')),
            ],
            onChanged: (val) {
              if (val != null) {
                setState(() => _defaultQuality = val);
                _storage.setVideoQualityPreference(val);
              }
            },
          ),
          Divider(color: AppColors.div(context), height: 32),

          // ── DISPLAY & FRAMERATE SECTION ──────────────────────────────────
          _buildSectionHeader('DISPLAY & FRAMERATE'),
          const SizedBox(height: 14),
          _buildDropdownItem(
            title: 'Display Refresh Rate',
            subtitle: 'Use the best refresh rate supported by your device. Higher rates make scrolling smoother but may use more battery.',
            value: _displayRefreshRate,
            items: [
              const DropdownMenuItem(value: 'auto', child: Text('Auto - Recommended')),
              const DropdownMenuItem(value: '60', child: Text('60Hz - Battery Saver')),
              if (_supports90Hz || _displayRefreshRate == '90') const DropdownMenuItem(value: '90', child: Text('90Hz - Smooth')),
              if (_supports120Hz || _displayRefreshRate == '120') const DropdownMenuItem(value: '120', child: Text('120Hz - Ultra Smooth')),
            ],
            onChanged: (val) {
              if (val != null) {
                setState(() => _displayRefreshRate = val);
                _storage.setDisplayRefreshRate(val);
                // Provide immediate feedback by setting the mode if supported
                if (!kIsWeb && Platform.isAndroid) {
                  if (val == '120' && _supports120Hz) FlutterDisplayMode.setHighRefreshRate();
                  else if (val == '90' && _supports90Hz) FlutterDisplayMode.setHighRefreshRate();
                  else if (val == '60') FlutterDisplayMode.setLowRefreshRate();
                  else FlutterDisplayMode.setPreferredMode(DisplayMode.auto);
                }
              }
            },
          ),
          if (!_supports120Hz && !_supports90Hz && !kIsWeb && Platform.isAndroid)
            Padding(
              padding: const EdgeInsets.only(bottom: 16.0),
              child: Text(
                'High refresh rate (90Hz/120Hz) is not supported on this device, or is limited by Battery Saver.',
                style: TextStyle(color: AppColors.textM(context), fontSize: 12),
              ),
            ),
          _buildSwitchItem(
            title: 'Match video frame rate',
            subtitle: 'Adjust display timing to match the channel\'s native frame rate where supported.',
            value: _matchVideoFrameRate,
            onChanged: (val) {
              setState(() => _matchVideoFrameRate = val);
              _storage.setMatchVideoFrameRate(val);
            },
          ),
          Divider(color: AppColors.div(context), height: 32),

          // ── DATA USAGE SECTION ───────────────────────────────────────────
          _buildSectionHeader('DATA USAGE'),
          const SizedBox(height: 14),
          _buildSwitchItem(
            title: 'Data Saver Mode',
            subtitle: 'Forces streams to lowest available quality to save mobile data',
            value: _dataSaverEnabled,
            onChanged: (val) {
              setState(() => _dataSaverEnabled = val);
              _storage.setDataSaverEnabled(val);
            },
          ),
          _buildSwitchItem(
            title: 'Auto quality on mobile data',
            subtitle: 'Automatically lowers quality when not on Wi-Fi',
            value: _autoMobileData,
            onChanged: (val) {
              setState(() => _autoMobileData = val);
              _storage.setAutoQualityOnMobileData(val);
            },
          ),
          _buildSwitchItem(
            title: 'Use HD only on Wi-Fi',
            subtitle: 'Prevents 720p and 1080p streams from loading on cellular networks',
            value: _hdOnlyWifi,
            onChanged: (val) {
              setState(() => _hdOnlyWifi = val);
              _storage.setHdOnlyOnWifi(val);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        color: Color(AppColors.primary),
        fontSize: 13,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.8,
      ),
    );
  }

  Widget _buildThemeSelector(ThemeMode currentMode, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfLight(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.div(context),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          _buildThemeSegment(
            label: 'Dark',
            icon: Icons.dark_mode_rounded,
            isSelected: currentMode == ThemeMode.dark,
            onTap: () => context.read<ThemeCubit>().setTheme(ThemeMode.dark),
          ),
          _buildThemeSegment(
            label: 'Light',
            icon: Icons.light_mode_rounded,
            isSelected: currentMode == ThemeMode.light,
            onTap: () => context.read<ThemeCubit>().setTheme(ThemeMode.light),
          ),
          _buildThemeSegment(
            label: 'System',
            icon: Icons.brightness_auto_rounded,
            isSelected: currentMode == ThemeMode.system,
            onTap: () => context.read<ThemeCubit>().setTheme(ThemeMode.system),
          ),
        ],
      ),
    );
  }

  Widget _buildThemeSegment({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? const Color(AppColors.primary)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(AppColors.primary).withOpacity(0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? Colors.white : AppColors.text2(context),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.text2(context),
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDropdownItem({
    required String title,
    required String subtitle,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: AppColors.text1(context),
              fontSize: 15.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: TextStyle(
              color: AppColors.textM(context),
              fontSize: 12.5,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: AppColors.surf(context),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.div(context),
                width: 0.8,
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                dropdownColor: AppColors.surf(context),
                value: value,
                items: items,
                onChanged: onChanged,
                style: TextStyle(
                  color: AppColors.text1(context),
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                ),
                icon: Icon(
                  Icons.arrow_drop_down,
                  color: AppColors.text2(context),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchItem({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(
        title,
        style: TextStyle(
          color: AppColors.text1(context),
          fontSize: 15.5,
          fontWeight: FontWeight.w700,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4.0),
        child: Text(
          subtitle,
          style: TextStyle(
            color: AppColors.textM(context),
            fontSize: 12.5,
          ),
        ),
      ),
      value: value,
      activeColor: const Color(AppColors.primary),
      onChanged: onChanged,
    );
  }
}
