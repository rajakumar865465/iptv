import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
import '../models/channel_model.dart';
import 'channel_logo.dart';
import 'premium_widgets.dart';

/// Layout variants for the unified premium channel card.
enum PremiumChannelCardVariant {
  /// Small portrait card for horizontal Home section rows.
  compact,

  /// Large featured portrait card for highlighted Home rows.
  featured,

  /// Expandable portrait card for two-column grids (Live TV / Favorites).
  grid,

  /// Small portrait card for the Player related-channels strip.
  related,

  /// Horizontal list tile for Search results.
  list,
}

/// Unified premium channel card used across Home, Live TV, Search,
/// Favorites, and the Player related section.
class PremiumChannelCard extends StatelessWidget {
  final ChannelModel channel;
  final VoidCallback onTap;
  final PremiumChannelCardVariant variant;
  final bool showFavorite;
  final bool? isFavorite;
  final VoidCallback? onFavoriteToggle;
  final EdgeInsetsGeometry? margin;

  const PremiumChannelCard({
    super.key,
    required this.channel,
    required this.onTap,
    this.variant = PremiumChannelCardVariant.grid,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return _TappableScale(
      onTap: onTap,
      child: switch (variant) {
        PremiumChannelCardVariant.compact => _CompactCard(
            channel: channel,
            showFavorite: showFavorite,
            isFavorite: isFavorite,
            onFavoriteToggle: onFavoriteToggle,
            margin: margin,
          ),
        PremiumChannelCardVariant.featured => _FeaturedCard(
            channel: channel,
            margin: margin,
          ),
        PremiumChannelCardVariant.grid => _GridCard(
            channel: channel,
            showFavorite: showFavorite,
            isFavorite: isFavorite,
            onFavoriteToggle: onFavoriteToggle,
            margin: margin,
          ),
        PremiumChannelCardVariant.related => _RelatedCard(
            channel: channel,
            margin: margin,
          ),
        PremiumChannelCardVariant.list => _ListCard(
            channel: channel,
            showFavorite: showFavorite,
            isFavorite: isFavorite,
            onFavoriteToggle: onFavoriteToggle,
            margin: margin,
          ),
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

class _TappableScale extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final double scale;

  const _TappableScale({
    required this.child,
    required this.onTap,
    this.scale = 0.96,
  });

  @override
  State<_TappableScale> createState() => _TappableScaleState();
}

class _TappableScaleState extends State<_TappableScale> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      behavior: HitTestBehavior.translucent,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        transform: Matrix4.identity()..scale(_pressed ? widget.scale : 1.0),
        transformAlignment: Alignment.center,
        child: widget.child,
      ),
    );
  }
}

String _detailLine(ChannelModel channel) {
  final parts = <String>[
    if (channel.categoryName != null && channel.categoryName!.trim().isNotEmpty)
      channel.categoryName!,
    if (channel.language != null && channel.language!.trim().isNotEmpty)
      channel.language!,
  ];
  return parts.join('  •  ');
}

bool _isOffline(ChannelModel channel) {
  final h = channel.healthStatus?.toLowerCase() ?? '';
  return h == 'offline' || h == 'dead';
}

bool _isUnstable(ChannelModel channel) {
  final h = channel.healthStatus?.toLowerCase() ?? '';
  return h == 'unstable' || h == 'weak' || h == 'buffering';
}

BoxDecoration _cardDecoration({bool offline = false}) {
  return BoxDecoration(
    color: const Color(AppColors.surface),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(
      color: offline
          ? const Color(AppColors.error).withOpacity(0.35)
          : const Color(AppColors.divider).withOpacity(0.65),
      width: 0.8,
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.25),
        blurRadius: 12,
        offset: const Offset(0, 5),
      ),
    ],
  );
}

Widget _logoContainer({
  required ChannelModel channel,
  required double containerSize,
  required double logoSize,
}) {
  return Container(
    width: containerSize,
    height: containerSize,
    padding: EdgeInsets.all(containerSize * 0.08),
    decoration: BoxDecoration(
      color: const Color(AppColors.surfaceElevated),
      borderRadius: BorderRadius.circular(containerSize * 0.2),
      border: Border.all(
        color: const Color(AppColors.divider),
        width: 0.8,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.15),
          blurRadius: 8,
          offset: const Offset(0, 3),
        ),
      ],
    ),
    child: ChannelLogo(
      logoUrl: channel.logoUrl,
      localLogoUrl: channel.localLogoUrl,
      channelName: channel.name,
      size: logoSize,
      borderRadius: logoSize * 0.18,
      fit: BoxFit.contain,
    ),
  );
}

Widget _topLeftBadge(ChannelModel channel) {
  if (channel.isPremium) return const _SmallPremiumBadge();
  if (channel.qualityLabel.isNotEmpty && channel.qualityLabel != 'SD') {
    return QualityBadge(channel.qualityLabel);
  }
  if (_isUnstable(channel)) return const _UnstableBadge();
  return const SizedBox.shrink();
}

Widget _offlineBanner() {
  return Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 4),
    color: const Color(AppColors.error).withOpacity(0.9),
    child: const Text(
      'OFFLINE',
      textAlign: TextAlign.center,
      style: TextStyle(
        color: Colors.white,
        fontSize: 8.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.5,
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact card
// ─────────────────────────────────────────────────────────────────────────────

class _CompactCard extends StatelessWidget {
  final ChannelModel channel;
  final bool showFavorite;
  final bool? isFavorite;
  final VoidCallback? onFavoriteToggle;
  final EdgeInsetsGeometry? margin;

  const _CompactCard({
    required this.channel,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);
    final offline = _isOffline(channel);

    return Container(
      width: 118,
      height: 168,
      margin: margin ?? const EdgeInsets.only(right: 12),
      decoration: _cardDecoration(offline: offline),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 26, 10, 10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _logoContainer(
                    channel: channel,
                    containerSize: 72,
                    logoSize: 56,
                  ),
                  const SizedBox(height: 11),
                  Text(
                    channel.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(AppColors.textPrimary),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                      height: 1.15,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      detail,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(AppColors.textMuted),
                        fontSize: 10,
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
            const Positioned(
              top: 10,
              right: 10,
              child: LiveBadge(small: true),
            ),
            Positioned(
              top: 10,
              left: 10,
              child: _topLeftBadge(channel),
            ),
            if (offline)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _offlineBanner(),
              ),
            if (showFavorite)
              Positioned(
                bottom: 6,
                right: 6,
                child: _FavoriteButton(
                  channel: channel,
                  isFavorite: isFavorite,
                  onFavoriteToggle: onFavoriteToggle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Featured card
// ─────────────────────────────────────────────────────────────────────────────

class _FeaturedCard extends StatelessWidget {
  final ChannelModel channel;
  final EdgeInsetsGeometry? margin;

  const _FeaturedCard({
    required this.channel,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);

    return Container(
      width: 232,
      height: 188,
      margin: margin ?? const EdgeInsets.only(right: 14),
      decoration: _cardDecoration(),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (channel.logoUrl != null && channel.logoUrl!.isNotEmpty)
              Positioned.fill(
                child: Opacity(
                  opacity: 0.06,
                  child: ChannelLogo(
                    logoUrl: channel.logoUrl,
                    localLogoUrl: channel.localLogoUrl,
                    channelName: channel.name,
                    size: 232,
                    borderRadius: 0,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0xB3000000),
                    ],
                    stops: [0.35, 1.0],
                  ),
                ),
              ),
            ),
            Positioned(
              top: 28,
              left: 0,
              right: 0,
              child: Center(
                child: _logoContainer(
                  channel: channel,
                  containerSize: 96,
                  logoSize: 80,
                ),
              ),
            ),
            const Positioned(
              top: 12,
              left: 12,
              child: LiveBadge(small: true),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: _topLeftBadge(channel),
            ),
            Positioned(
              left: 14,
              right: 14,
              bottom: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    channel.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.3,
                      height: 1.15,
                      shadows: [
                        Shadow(blurRadius: 10, color: Colors.black87),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      detail,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.75),
                        fontSize: 11,
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
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card
// ─────────────────────────────────────────────────────────────────────────────

class _GridCard extends StatelessWidget {
  final ChannelModel channel;
  final bool showFavorite;
  final bool? isFavorite;
  final VoidCallback? onFavoriteToggle;
  final EdgeInsetsGeometry? margin;

  const _GridCard({
    required this.channel,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);
    final offline = _isOffline(channel);

    return Container(
      margin: margin ?? EdgeInsets.zero,
      decoration: _cardDecoration(offline: offline),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 24, 10, 10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _logoContainer(
                    channel: channel,
                    containerSize: 72,
                    logoSize: 56,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    channel.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(AppColors.textPrimary),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                      height: 1.15,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      detail,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(AppColors.textMuted),
                        fontSize: 10,
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
            const Positioned(
              top: 10,
              right: 10,
              child: LiveBadge(small: true),
            ),
            Positioned(
              top: 10,
              left: 10,
              child: _topLeftBadge(channel),
            ),
            if (offline)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _offlineBanner(),
              ),
            if (showFavorite)
              Positioned(
                bottom: 6,
                right: 6,
                child: _FavoriteButton(
                  channel: channel,
                  isFavorite: isFavorite,
                  onFavoriteToggle: onFavoriteToggle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Related card
// ─────────────────────────────────────────────────────────────────────────────

class _RelatedCard extends StatelessWidget {
  final ChannelModel channel;
  final EdgeInsetsGeometry? margin;

  const _RelatedCard({
    required this.channel,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);

    return Container(
      width: 108,
      height: 138,
      margin: margin ?? const EdgeInsets.only(right: 10),
      decoration: _cardDecoration(),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 22, 8, 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _logoContainer(
                    channel: channel,
                    containerSize: 56,
                    logoSize: 44,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    channel.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(AppColors.textPrimary),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.1,
                      height: 1.15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      detail,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(AppColors.textMuted),
                        fontSize: 9,
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
            const Positioned(
              top: 8,
              right: 8,
              child: LiveBadge(small: true),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// List card
// ─────────────────────────────────────────────────────────────────────────────

class _ListCard extends StatelessWidget {
  final ChannelModel channel;
  final bool showFavorite;
  final bool? isFavorite;
  final VoidCallback? onFavoriteToggle;
  final EdgeInsetsGeometry? margin;

  const _ListCard({
    required this.channel,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);
    final offline = _isOffline(channel);

    return Container(
      margin: margin ?? const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(AppColors.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: offline
              ? const Color(AppColors.error).withOpacity(0.35)
              : const Color(AppColors.divider),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          _logoContainer(
            channel: channel,
            containerSize: 52,
            logoSize: 44,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  channel.name,
                  style: const TextStyle(
                    color: Color(AppColors.textPrimary),
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.1,
                    height: 1.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (detail.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    detail,
                    style: const TextStyle(
                      color: Color(AppColors.textMuted),
                      fontSize: 12,
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
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              const LiveBadge(small: true),
              if (channel.qualityLabel.isNotEmpty && channel.qualityLabel != 'SD') ...[
                const SizedBox(height: 4),
                QualityBadge(channel.qualityLabel),
              ],
            ],
          ),
          if (showFavorite) ...[
            const SizedBox(width: 8),
            _FavoriteButton(
              channel: channel,
              isFavorite: isFavorite,
              onFavoriteToggle: onFavoriteToggle,
            ),
          ] else ...[
            const SizedBox(width: 8),
            const Icon(
              Icons.play_circle_rounded,
              color: Color(AppColors.primary),
              size: 24,
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Favorite button
// ─────────────────────────────────────────────────────────────────────────────

class _FavoriteButton extends StatelessWidget {
  final ChannelModel channel;
  final bool? isFavorite;
  final VoidCallback? onFavoriteToggle;

  const _FavoriteButton({
    required this.channel,
    this.isFavorite,
    this.onFavoriteToggle,
  });

  @override
  Widget build(BuildContext context) {
    if (isFavorite != null) {
      return GestureDetector(
        onTap: onFavoriteToggle,
        behavior: HitTestBehavior.opaque,
        child: _FavoriteIcon(isFav: isFavorite!),
      );
    }

    return BlocBuilder<FavoriteCubit, FavoriteState>(
      builder: (context, state) {
        final isFav = state is FavoriteLoaded &&
            state.favorites.any((c) => c.id == channel.id);

        return GestureDetector(
          onTap: () {
            if (onFavoriteToggle != null) {
              onFavoriteToggle!();
            } else {
              context.read<FavoriteCubit>().toggleFavorite(
                    channel.id,
                    isFavorite: isFav,
                  );
            }
          },
          behavior: HitTestBehavior.opaque,
          child: _FavoriteIcon(isFav: isFav),
        );
      },
    );
  }
}

class _FavoriteIcon extends StatelessWidget {
  final bool isFav;

  const _FavoriteIcon({required this.isFav});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(AppColors.surfaceElevated).withOpacity(0.95),
        shape: BoxShape.circle,
        border: Border.all(
          color: const Color(AppColors.divider),
          width: 0.8,
        ),
      ),
      child: Icon(
        isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        size: 16,
        color: isFav
            ? const Color(AppColors.brandRed)
            : const Color(AppColors.textMuted),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

class _SmallPremiumBadge extends StatelessWidget {
  const _SmallPremiumBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFCA28),
            Color(0xFFFF8F00),
          ],
        ),
        borderRadius: BorderRadius.circular(5),
        boxShadow: [
          BoxShadow(
            color: const Color(AppColors.premiumGold).withOpacity(0.4),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
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

class _UnstableBadge extends StatelessWidget {
  const _UnstableBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(AppColors.warning).withOpacity(0.18),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: const Color(AppColors.warning).withOpacity(0.35),
          width: 0.8,
        ),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.warning_amber_rounded,
            size: 8,
            color: Color(AppColors.warning),
          ),
          SizedBox(width: 2),
          Text(
            'Unstable',
            style: TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w800,
              color: Color(AppColors.warning),
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
