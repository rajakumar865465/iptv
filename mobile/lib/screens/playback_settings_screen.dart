import 'package:flutter/material.dart';
import '../constants.dart';
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

    if (mounted) {
      setState(() {
        _defaultQuality = defaultQuality;
        _dataSaverEnabled = dataSaver;
        _autoMobileData = autoMobile;
        _hdOnlyWifi = hdOnlyWifi;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        title: const Text('Playback Settings', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'VIDEO QUALITY',
            style: TextStyle(color: Color(AppColors.primary), fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
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
          const Divider(color: Color(AppColors.surfaceLight), height: 32),
          const Text(
            'DATA USAGE',
            style: TextStyle(color: Color(AppColors.primary), fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
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
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(AppColors.surface),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                dropdownColor: const Color(AppColors.surface),
                value: value,
                items: items,
                onChanged: onChanged,
                style: const TextStyle(color: Colors.white, fontSize: 16),
                icon: const Icon(Icons.arrow_drop_down, color: Colors.white54),
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
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4.0),
        child: Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12)),
      ),
      value: value,
      activeColor: const Color(AppColors.primary),
      onChanged: onChanged,
    );
  }
}
