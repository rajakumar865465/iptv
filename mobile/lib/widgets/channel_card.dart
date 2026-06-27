import 'package:flutter/material.dart';
import '../constants.dart';
import '../models/channel_model.dart';
import 'channel_logo.dart';

/// Standard 2-column channel grid card for the Live TV screen.
class ChannelCard extends StatelessWidget {
  final ChannelModel channel;
  final VoidCallback onTap;

  const ChannelCard({super.key, required this.channel, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final detailText = [channel.language, channel.qualityLabel]
        .where((e) => e != null && e.isNotEmpty)
        .join(' • ');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF282828), width: 0.5),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Stack(children: [
          // LIVE badge top-right
          Positioned(
            top: 8, right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFFF1744), Color(0xFFE50914)]),
                borderRadius: BorderRadius.circular(4),
                boxShadow: [BoxShadow(color: const Color(0xFFE50914).withOpacity(0.4), blurRadius: 6)],
              ),
              child: const Text('LIVE',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.8)),
            ),
          ),

          // Health badge bottom-left
          if (_healthBadge(channel.healthStatus) != null)
            Positioned(bottom: 8, left: 8, child: _healthBadge(channel.healthStatus)!),

          // Premium badge top-left
          if (channel.isPremium)
            Positioned(
              top: 8, left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFFFB300), borderRadius: BorderRadius.circular(4)),
                child: const Text('PRO',
                    style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.black, letterSpacing: 0.5)),
              ),
            ),

          // Quality badge (right of premium or top-left area)
          if (!channel.isPremium && channel.qualityLabel != 'SD')
            Positioned(
              top: 8, left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: channel.qualityLabel == '4K' ? const Color(0xFF6200EA) : const Color(0xFF1565C0),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(channel.qualityLabel,
                    style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.3)),
              ),
            ),

          // Content
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 20, 12, 24),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: const Color(0xFF383838), width: 1.5),
                ),
                child: ChannelLogo(
                  logoUrl: channel.logoUrl, localLogoUrl: channel.localLogoUrl,
                  channelName: channel.name, size: 58, borderRadius: 10, fit: BoxFit.contain),
              ),
              const SizedBox(height: 8),
              Text(channel.name,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12.5, letterSpacing: -0.1),
                  maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
              if (channel.categoryName != null) ...[
                const SizedBox(height: 3),
                Text(channel.categoryName!,
                    style: const TextStyle(color: Color(AppColors.textSecondary), fontSize: 10.5),
                    maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
              ],
              if (detailText.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(detailText,
                    style: const TextStyle(color: Color(AppColors.textMuted), fontSize: 10),
                    maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
              ],
            ]),
          ),
        ]),
      ),
    );
  }

  /// Returns a small coloured health badge or null for clean states.
  Widget? _healthBadge(String? status) {
    if (status == null) return null;
    final h = status.toLowerCase();
    switch (h) {
      case 'online':
      case 'playable':
      case 'stable':
        return null; // clean — no badge
      case 'unstable':
        return _badge('Unstable', const Color(0xFFFF9800));
      case 'offline':
      case 'dead':
        return _badge('Offline', const Color(0xFFF44336));
      case 'drm_or_unsupported':
        return _badge('Unsupported', const Color(0xFF9E9E9E));
      case 'geo_blocked':
        return _badge('Geo-Blocked', const Color(0xFF9E9E9E));
      case 'requires_licensed_source':
        return _badge('Source Req.', const Color(0xFF9C27B0));
      default:
        return null;
    }
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.85), borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white)),
    );
  }
}
