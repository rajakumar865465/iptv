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
  final bool isLocked;

  const PremiumChannelCard({
    super.key,
    required this.channel,
    required this.onTap,
    this.variant = PremiumChannelCardVariant.grid,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
    this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    return _TappableScale(
      onTap: onTap,
      child: Stack(
        children: [
          switch (variant) {
            PremiumChannelCardVariant.compact => _CompactCard(
                channel: channel,
                showFavorite: showFavorite,
                isFavorite: isFavorite,
                onFavoriteToggle: onFavoriteToggle,
                margin: margin,
                isLocked: isLocked,
              ),
            PremiumChannelCardVariant.featured => _FeaturedCard(
                channel: channel,
                margin: margin,
                isLocked: isLocked,
              ),
            PremiumChannelCardVariant.grid => _GridCard(
                channel: channel,
                showFavorite: showFavorite,
                isFavorite: isFavorite,
                onFavoriteToggle: onFavoriteToggle,
                margin: margin,
                isLocked: isLocked,
              ),
            PremiumChannelCardVariant.related => _RelatedCard(
                channel: channel,
                margin: margin,
                isLocked: isLocked,
              ),
            PremiumChannelCardVariant.list => _ListCard(
                channel: channel,
                showFavorite: showFavorite,
                isFavorite: isFavorite,
                onFavoriteToggle: onFavoriteToggle,
                margin: margin,
                isLocked: isLocked,
              ),
          },
          if (isLocked)
            Positioned.fill(
              child: Container(
                margin: margin ?? EdgeInsets.zero,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(variant == PremiumChannelCardVariant.list ? 14 : 20),
                ),
                child: const Center(
                  child: Icon(
                    Icons.lock_rounded,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

class _TappableScale extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;

  const _TappableScale({
    required this.child,
    required this.onTap,
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
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOutCubic,
        transform: Matrix4.identity()..scale(_pressed ? 0.93 : 1.0),
        transformAlignment: Alignment.center,
        child: widget.child,
      ),
    );
  }
}

String _detailLine(ChannelModel channel) {
  if (channel.categoryName != null && channel.categoryName!.trim().isNotEmpty) {
    return channel.categoryName!.trim();
  }
  if (channel.language != null && channel.language!.trim().isNotEmpty) {
    return channel.language!.trim();
  }
  return '';
}

String _cleanChannelName(String name) {
  return name
      .replaceAll(
        RegExp(
          r'\s*[\(\[]\s*(1080p|720p|576p|480p|360p|240p|4k|SD|HD|FHD|Geo-blocked|Not 24/7)[^\)\]]*[\)\]]\s*',
          caseSensitive: false,
        ),
        ' ',
      )
      .replaceAll(RegExp(r'\s+APAC\b', caseSensitive: false), '')
      .replaceAll(RegExp(r'\s{2,}'), ' ')
      .trim();
}

bool _isOffline(ChannelModel channel) {
  final h = channel.healthStatus?.toLowerCase() ?? '';
  final s = channel.status.toLowerCase();
  return h == 'dead' || s == 'disabled';
}

bool _isUnstable(ChannelModel channel) {
  final h = channel.healthStatus?.toLowerCase() ?? '';
  return h == 'unstable' || h == 'weak' || h == 'buffering';
}

BoxDecoration _cardDecoration(BuildContext context, {bool offline = false}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return BoxDecoration(
    color: AppColors.surf(context),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(
      color: offline
          ? const Color(AppColors.error).withOpacity(0.4)
          : (isDark
              ? AppColors.div(context).withOpacity(0.65)
              : const Color(0xFFE2E8F0)),
      width: 0.8,
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(isDark ? 0.25 : 0.04),
        blurRadius: 10,
        offset: const Offset(0, 3),
      ),
      if (!isDark)
        BoxShadow(
          color: Colors.black.withOpacity(0.015),
          blurRadius: 2,
          offset: const Offset(0, 1),
        ),
    ],
  );
}

Widget _logoContainer(
  BuildContext context, {
  required ChannelModel channel,
  required double containerSize,
  required double logoSize,
}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return Container(
    width: containerSize,
    height: containerSize,
    padding: EdgeInsets.all(containerSize * 0.08),
    decoration: BoxDecoration(
      color: isDark
          ? AppColors.surfElevated(context)
          : const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(containerSize * 0.22),
      border: Border.all(
        color: isDark
            ? AppColors.div(context)
            : const Color(0xFFE2E8F0),
        width: 0.8,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(isDark ? 0.15 : 0.03),
          blurRadius: 6,
          offset: const Offset(0, 2),
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
  final bool isLocked;

  const _CompactCard({
    required this.channel,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
      this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);
    final offline = _isOffline(channel);

    return Container(
      width: 122,
      height: 156,
      margin: margin ?? const EdgeInsets.only(right: 12),
      decoration: _cardDecoration(context, offline: offline),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            Positioned.fill(
              child: Padding(
                padding: EdgeInsets.fromLTRB(8, 22, 8, offline ? 22 : 8),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _logoContainer(
                      context,
                      channel: channel,
                      containerSize: 60,
                      logoSize: 46,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _cleanChannelName(channel.name),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.text1(context),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        height: 1.15,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (!offline) ...[
                      const SizedBox(height: 4),
                      Text(
                        detail.isNotEmpty ? detail : 'Live',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.textM(context),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: _topLeftBadge(channel),
            ),
            if (showFavorite)
              Positioned(
                top: 6,
                right: 6,
                child: _FavoriteButton(
                  channel: channel,
                  isFavorite: isFavorite,
                  onFavoriteToggle: onFavoriteToggle,
                ),
              )
            else if (!offline)
              const Positioned(
                top: 8,
                right: 8,
                child: LiveBadge(small: true),
              ),
            if (offline)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _offlineBanner(),
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
  final bool isLocked;

  const _FeaturedCard({
    required this.channel,
    this.margin,
      this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);

    return Container(
      width: 232,
      height: 188,
      margin: margin ?? const EdgeInsets.only(right: 14),
      decoration: _cardDecoration(context),
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
                  context,
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
                    _cleanChannelName(channel.name),
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
  final bool isLocked;

  const _GridCard({
    required this.channel,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
    this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);
    final offline = _isOffline(channel);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: margin ?? EdgeInsets.zero,
      decoration: BoxDecoration(
        color: AppColors.surfElevated(context),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: offline
              ? const Color(AppColors.error).withOpacity(0.35)
              : AppColors.div(context).withOpacity(0.6),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.32 : 0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Faint watermark from channel logo
            if (channel.logoUrl != null && channel.logoUrl!.isNotEmpty)
              Positioned.fill(
                child: Opacity(
                  opacity: 0.05,
                  child: ChannelLogo(
                    logoUrl: channel.logoUrl,
                    localLogoUrl: channel.localLogoUrl,
                    channelName: channel.name,
                    size: 300,
                    borderRadius: 0,
                    fit: BoxFit.cover,
                  ),
                ),
              ),

            // Logo centered in upper area
            Positioned(
              top: 16,
              left: 0,
              right: 0,
              bottom: 72,
              child: Center(
                child: _logoContainer(
                  context,
                  channel: channel,
                  containerSize: 86,
                  logoSize: 70,
                ),
              ),
            ),

            // Gradient overlay at bottom
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 92,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      isDark ? const Color(0xEE000008) : Colors.white.withOpacity(0.95),
                    ],
                    stops: const [0.0, 1.0],
                  ),
                ),
              ),
            ),

            // Channel name + detail
            Positioned(
              left: 11,
              right: 11,
              bottom: offline ? 24 : 11,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _cleanChannelName(channel.name),
                    style: TextStyle(
                      color: AppColors.text1(context),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (!offline) ...[
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: const BoxDecoration(
                            color: Color(AppColors.brandRed),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            detail.isNotEmpty ? detail : 'Live TV',
                            style: TextStyle(
                              color: isDark ? Colors.white.withOpacity(0.6) : AppColors.textM(context),
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              height: 1.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // Quality / premium / unstable badge — top left
            Positioned(
              top: 10,
              left: 10,
              child: _topLeftBadge(channel),
            ),

            // Top right: Favorite button (if enabled) or LIVE badge
            if (showFavorite)
              Positioned(
                top: 8,
                right: 8,
                child: _FavoriteButton(
                  channel: channel,
                  isFavorite: isFavorite,
                  onFavoriteToggle: onFavoriteToggle,
                ),
              )
            else if (!offline)
              const Positioned(
                top: 10,
                right: 10,
                child: LiveBadge(small: true),
              ),

            // Offline banner
            if (offline)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _offlineBanner(),
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
  final bool isLocked;

  const _RelatedCard({
    required this.channel,
    this.margin,
      this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);

    return Container(
      width: 108,
      height: 138,
      margin: margin ?? const EdgeInsets.only(right: 10),
      decoration: _cardDecoration(context),
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
                    context,
                    channel: channel,
                    containerSize: 56,
                    logoSize: 44,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _cleanChannelName(channel.name),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.text1(context),
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
                      style: TextStyle(
                        color: AppColors.textM(context),
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
  final bool isLocked;

  const _ListCard({
    required this.channel,
    this.showFavorite = false,
    this.isFavorite,
    this.onFavoriteToggle,
    this.margin,
      this.isLocked = false,
  });

  @override
  Widget build(BuildContext context) {
    final detail = _detailLine(channel);
    final offline = _isOffline(channel);

    return Container(
      margin: margin ?? const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surf(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: offline
              ? const Color(AppColors.error).withOpacity(0.35)
              : AppColors.div(context),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          _logoContainer(
            context,
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
                  _cleanChannelName(channel.name),
                  style: TextStyle(
                    color: AppColors.text1(context),
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
                    style: TextStyle(
                      color: AppColors.textM(context),
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
              if (!offline) const LiveBadge(small: true),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      transitionBuilder: (child, animation) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: animation, curve: Curves.elasticOut),
          child: child,
        );
      },
      child: Container(
        key: ValueKey<bool>(isFav),
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: AppColors.surf(context).withOpacity(0.9),
          shape: BoxShape.circle,
          border: Border.all(
            color: isFav
                ? const Color(AppColors.brandRed).withOpacity(0.45)
                : AppColors.div(context).withOpacity(0.6),
            width: 0.8,
          ),
        ),
        child: Icon(
          isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          size: 14,
          color: isFav
              ? const Color(AppColors.brandRed)
              : (isDark ? Colors.white.withOpacity(0.8) : const Color(0xFF64748B)),
        ),
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
