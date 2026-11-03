import 'dart:async';
import 'package:flutter/material.dart';
import '../../constants.dart';
import '../../models/channel_model.dart';
import '../channel_logo.dart';
import '../premium_widgets.dart';

/// Interactive Featured Live Channels Hero Carousel with graceful static fallback.
class HomeHero extends StatefulWidget {
  final VoidCallback onStartWatching;
  final List<ChannelModel> featuredChannels;
  final ValueChanged<ChannelModel>? onPlayChannel;

  const HomeHero({
    super.key,
    required this.onStartWatching,
    this.featuredChannels = const [],
    this.onPlayChannel,
  });

  @override
  State<HomeHero> createState() => _HomeHeroState();
}

class _HomeHeroState extends State<HomeHero> {
  late final PageController _pageController;
  Timer? _autoSlideTimer;
  int _currentIndex = 0;

  List<ChannelModel> get _slides => widget.featuredChannels.take(5).toList();

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _startTimer();
  }

  @override
  void didUpdateWidget(covariant HomeHero oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.featuredChannels.length != widget.featuredChannels.length) {
      _currentIndex = 0;
      _startTimer();
    }
  }

  void _startTimer() {
    _autoSlideTimer?.cancel();
    if (_slides.length <= 1) return;
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_pageController.hasClients || _slides.length <= 1) return;
      final next = (_currentIndex + 1) % _slides.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  String _cleanTitle(String name) {
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

  @override
  Widget build(BuildContext context) {
    final slides = _slides;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        height: 178,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF101738),
              Color(0xFF1B1145),
              Color(0xFF2D0B28),
            ],
            stops: [0.0, 0.55, 1.0],
          ),
          border: Border.all(
            color: Colors.white.withOpacity(0.10),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(AppColors.primary).withOpacity(0.20),
              blurRadius: 28,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            children: [
              // Decorative ambient glows
              Positioned(
                top: -40,
                right: -30,
                child: Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(AppColors.primary).withOpacity(0.16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(AppColors.primary).withOpacity(0.22),
                        blurRadius: 60,
                        spreadRadius: 20,
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: -50,
                left: -20,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(AppColors.brandRed).withOpacity(0.12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(AppColors.brandRed).withOpacity(0.18),
                        blurRadius: 50,
                        spreadRadius: 16,
                      ),
                    ],
                  ),
                ),
              ),
              if (slides.isEmpty)
                _buildFallbackSlide()
              else
                PageView.builder(
                  controller: _pageController,
                  itemCount: slides.length,
                  onPageChanged: (idx) => setState(() => _currentIndex = idx),
                  itemBuilder: (context, index) => _buildChannelSlide(slides[index]),
                ),
              if (slides.length > 1)
                Positioned(
                  right: 20,
                  bottom: 18,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(slides.length, (i) {
                      final active = i == _currentIndex;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 240),
                        margin: const EdgeInsets.only(left: 5),
                        width: active ? 18 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: active
                              ? const Color(AppColors.brandRed)
                              : Colors.white.withOpacity(0.28),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChannelSlide(ChannelModel channel) {
    final category = (channel.categoryName?.trim().isNotEmpty ?? false)
        ? channel.categoryName!.trim()
        : (channel.language?.trim().isNotEmpty ?? false)
            ? channel.language!.trim()
            : 'Live Broadcast';

    return GestureDetector(
      onTap: () {
        if (widget.onPlayChannel != null) {
          widget.onPlayChannel!(channel);
        } else {
          widget.onStartWatching();
        }
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const LiveBadge(small: false),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.10),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              category.toUpperCase(),
                              style: const TextStyle(
                                color: Color(AppColors.textSecondary),
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _cleanTitle(channel.name),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'Streaming live in ${channel.qualityLabel.isNotEmpty ? channel.qualityLabel : 'HD'} • Instant playback',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: const Color(AppColors.textSecondary).withOpacity(0.9),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  _buildWatchButton(),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Container(
              width: 82,
              height: 82,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(AppColors.surfaceElevated).withOpacity(0.85),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: Colors.white.withOpacity(0.14),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: ChannelLogo(
                logoUrl: channel.logoUrl,
                localLogoUrl: channel.localLogoUrl,
                channelName: channel.name,
                size: 64,
                borderRadius: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFallbackSlide() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const LiveBadge(small: false),
              const SizedBox(height: 10),
              const Text(
                "Watch What's On",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Sports, News & Entertainment streaming live right now.',
                style: TextStyle(
                  color: const Color(AppColors.textSecondary).withOpacity(0.95),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                  height: 1.35,
                ),
              ),
            ],
          ),
          GestureDetector(
            onTap: widget.onStartWatching,
            child: _buildWatchButton(),
          ),
        ],
      ),
    );
  }

  Widget _buildWatchButton() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(AppColors.primary),
            Color(AppColors.brandRed),
          ],
        ),
        borderRadius: BorderRadius.circular(24),
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
            Icons.play_arrow_rounded,
            color: Colors.white,
            size: 18,
          ),
          SizedBox(width: 6),
          Text(
            'Watch Live',
            style: TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
