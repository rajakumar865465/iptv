import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../constants.dart';
import '../../cubits/favorite_cubit.dart';
import '../../models/channel_model.dart';
import '../channel_logo.dart';
import '../premium_widgets.dart';

/// Single-row entry for the Live TV A–Z / channel-number directory.
///
/// Layout:  [ 007 ]  (logo)  Channel Name              LIVE  HD  ♥
///                            Category • Language
///
/// Distinct from the grid/list card variants in premium_channel_card.dart —
/// this is a dense, scannable directory row with a permanent number badge.
class ChannelDirectoryRow extends StatelessWidget {
  final ChannelModel channel;
  final VoidCallback onTap;
  final bool showFavorite;
  final bool isLocked;

  const ChannelDirectoryRow({
    super.key,
    required this.channel,
    required this.onTap,
    this.showFavorite = true,
    this.isLocked = false,
  });

  bool get _offline {
    final h = channel.healthStatus?.toLowerCase() ?? '';
    return h == 'offline' || h == 'dead';
  }

  String get _detail {
    final parts = <String>[
      if (channel.categoryName != null && channel.categoryName!.trim().isNotEmpty)
        channel.categoryName!,
      if (channel.language != null && channel.language!.trim().isNotEmpty)
        channel.language!,
    ];
    return parts.join('  •  ');
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          decoration: BoxDecoration(
            color: AppColors.surf(context),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _offline
                  ? const Color(AppColors.error).withOpacity(0.35)
                  : (Theme.of(context).brightness == Brightness.dark
                      ? AppColors.div(context).withOpacity(0.6)
                      : const Color(0xFFE2E8F0)),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(
                  Theme.of(context).brightness == Brightness.dark ? 0.2 : 0.035,
                ),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
              if (Theme.of(context).brightness != Brightness.dark)
                BoxShadow(
                  color: Colors.black.withOpacity(0.015),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
            ],
          ),
          child: Row(
            children: [
              // Permanent channel number badge (monospace, tabular)
              _NumberBadge(label: channel.numberLabel),
              const SizedBox(width: 10),

              // Logo
              Container(
                width: 46,
                height: 46,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? AppColors.surfElevated(context)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.div(context)
                        : const Color(0xFFE2E8F0),
                    width: 0.8,
                  ),
                ),
                child: ChannelLogo(
                  logoUrl: channel.logoUrl,
                  localLogoUrl: channel.localLogoUrl,
                  channelName: channel.name,
                  size: 38,
                  borderRadius: 8,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(width: 12),

              // Name + detail
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      channel.name,
                      style: TextStyle(
                        color: AppColors.text1(context),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.1,
                        height: 1.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (detail.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        detail,
                        style: TextStyle(
                          color: AppColors.textM(context),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          height: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Status chips
              if (_offline)
                const _OfflineChip()
              else ...[
                if (isLocked)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: const Icon(Icons.lock_rounded, size: 10, color: Colors.white),
                  )
                else ...[
                  if (channel.isPremium)
                    const _ProChip()
                  else if (channel.qualityLabel.isNotEmpty && channel.qualityLabel != 'SD')
                    QualityBadge(channel.qualityLabel),
                  const SizedBox(width: 6),
                  const LiveBadge(small: true),
                ]
              ],

              // Favorite toggle
              if (showFavorite) ...[
                const SizedBox(width: 4),
                _FavoriteToggle(channel: channel),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NumberBadge extends StatelessWidget {
  final String? label;
  const _NumberBadge({this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 44,
      height: 42,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.surfLight(context)
            : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark
              ? AppColors.div(context)
              : const Color(0xFFE2E8F0),
          width: 0.8,
        ),
      ),
      child: Text(
        label ?? '—',
        maxLines: 1,
        style: TextStyle(
          color: label == null
              ? AppColors.textM(context)
              : (isDark ? AppColors.text1(context) : const Color(0xFF1E293B)),
          fontSize: (label != null && label!.length > 3) ? 11.5 : 13.0,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.2,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

class _OfflineChip extends StatelessWidget {
  const _OfflineChip();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(AppColors.error).withOpacity(0.15)
            : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: isDark
              ? const Color(AppColors.error).withOpacity(0.3)
              : const Color(0xFFFECACA),
          width: 0.6,
        ),
      ),
      child: const Text(
        'OFFLINE',
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w800,
          color: Color(AppColors.error),
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _ProChip extends StatelessWidget {
  const _ProChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFCA28), Color(0xFFFF8F00)],
        ),
        borderRadius: BorderRadius.circular(5),
      ),
      child: const Text(
        'PRO',
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w900,
          color: Colors.black,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _FavoriteToggle extends StatelessWidget {
  final ChannelModel channel;
  const _FavoriteToggle({required this.channel});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<FavoriteCubit, FavoriteState>(
      builder: (context, state) {
        final isFav = state is FavoriteLoaded &&
            state.favorites.any((c) => c.id == channel.id);
        return GestureDetector(
          onTap: () => context
              .read<FavoriteCubit>()
              .toggleFavorite(channel.id, isFavorite: isFav),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(
              isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              size: 20,
              color: isFav
                  ? const Color(AppColors.brandRed)
                  : AppColors.textM(context),
            ),
          ),
        );
      },
    );
  }
}
