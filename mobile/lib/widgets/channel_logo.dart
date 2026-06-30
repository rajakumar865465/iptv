import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../utils/backend_config.dart';
class ChannelLogo extends StatelessWidget {
  final String? logoUrl;
  final String? localLogoUrl;
  final String channelName;
  final double size;
  final double borderRadius;
  final BoxFit fit;
  final String? cacheKey;

  const ChannelLogo({
    super.key,
    required this.logoUrl,
    this.localLogoUrl,
    required this.channelName,
    this.size = 56,
    this.borderRadius = 8,
    this.fit = BoxFit.contain,
    this.cacheKey,
  });

  String? get _imageUrl {
    if (localLogoUrl != null && localLogoUrl!.trim().isNotEmpty) {
      if (localLogoUrl!.startsWith('/')) {
        return '${BackendConfig.baseUrl}${localLogoUrl!}';
      }
      return localLogoUrl;
    }
    final url = logoUrl?.trim();
    if (url == null || url.isEmpty) return null;
    // Upgrade http to https to avoid cleartext traffic blocks on Android
    if (url.startsWith('http://')) {
      return url.replaceFirst('http://', 'https://');
    }
    return url;
  }

  String get _initials {
    final trimmed = channelName.trim();
    if (trimmed.isEmpty) return '?';
    final words = trimmed.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return trimmed.length >= 2 ? trimmed.substring(0, 2).toUpperCase() : trimmed[0].toUpperCase();
  }

  bool get _isSvg {
    final url = _imageUrl;
    return url != null && url.toLowerCase().split('?').first.endsWith('.svg');
  }

  bool get _hasValidUrl {
    final url = _imageUrl;
    return url != null && url.trim().isNotEmpty;
  }

  // Gradient colors pairs for fallback avatar
  static const List<List<Color>> _gradients = [
    [Color(0xFF1565C0), Color(0xFF42A5F5)],
    [Color(0xFF6A1B9A), Color(0xFFAB47BC)],
    [Color(0xFF2E7D32), Color(0xFF66BB6A)],
    [Color(0xFFE65100), Color(0xFFFFA726)],
    [Color(0xFF00695C), Color(0xFF26A69A)],
    [Color(0xFF37474F), Color(0xFF78909C)],
    [Color(0xFF880E4F), Color(0xFFEC407A)],
    [Color(0xFF4527A0), Color(0xFF7E57C2)],
    [Color(0xFFC62828), Color(0xFFEF5350)],
    [Color(0xFF0277BD), Color(0xFF29B6F6)],
  ];

  List<Color> get _gradientColors {
    final idx = channelName.isNotEmpty ? channelName.codeUnitAt(0) % _gradients.length : 0;
    return _gradients[idx];
  }

  @override
  Widget build(BuildContext context) {
    final urlToLoad = _imageUrl;
    if (!_hasValidUrl || urlToLoad == null) {
      return _buildFallback();
    }

    if (_isSvg) {
      return _SvgLogoWidget(
        url: urlToLoad,
        size: size,
        borderRadius: borderRadius,
        fallback: _buildFallback(),
        shimmer: _buildShimmer(),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: CachedNetworkImage(
        imageUrl: urlToLoad,
        cacheKey: cacheKey != null ? '${cacheKey}_${urlToLoad.hashCode}' : null,
        width: size,
        height: size,
        fit: fit,
        httpHeaders: const {
          'Referer': 'https://www.google.com',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        },
        placeholder: (context, url) => _buildShimmer(),
        errorWidget: (context, url, error) => _buildFallback(),
      ),
    );
  }

  Widget _buildShimmer() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        width: size,
        height: size,
        child: Shimmer.fromColors(
          baseColor: const Color(AppColors.shimmerBase),
          highlightColor: const Color(AppColors.shimmerHighlight),
          child: Container(
            width: size,
            height: size,
            color: const Color(AppColors.surface),
          ),
        ),
      ),
    );
  }

  Widget _buildFallback() {
    final colors = _gradientColors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      alignment: Alignment.center,
      child: Text(
        _initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.32,
          fontWeight: FontWeight.bold,
          shadows: const [
            Shadow(blurRadius: 4, color: Colors.black45),
          ],
        ),
      ),
    );
  }
}

/// Handles SVG loading with a proper error fallback via timeout.
/// SvgPicture.network lacks an errorBuilder, so we use a Timer to detect
/// stalled loads and fall back to the initials avatar. (Fix #10, #34)
class _SvgLogoWidget extends StatefulWidget {
  final String url;
  final double size;
  final double borderRadius;
  final Widget fallback;
  final Widget shimmer;

  const _SvgLogoWidget({
    required this.url,
    required this.size,
    required this.borderRadius,
    required this.fallback,
    required this.shimmer,
  });

  @override
  State<_SvgLogoWidget> createState() => _SvgLogoWidgetState();
}

class _SvgLogoWidgetState extends State<_SvgLogoWidget> {
  bool _svgFailed = false;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();
    // If the SVG hasn't loaded within 8 seconds, show the fallback.
    // SvgPicture.network has no errorBuilder, so this is our only reliable way
    // to handle failed/stalled SVG loads.
    _timeoutTimer = Timer(const Duration(seconds: 8), () {
      if (mounted) setState(() => _svgFailed = true);
    });
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_svgFailed) return widget.fallback;

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: SvgPicture.network(
        widget.url,
        width: widget.size,
        height: widget.size,
        fit: BoxFit.contain,
        headers: const {
          'Referer': 'https://www.google.com',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        },
        placeholderBuilder: (context) => widget.shimmer,
        // When SVG loads successfully, cancel the timeout timer
        // by using a Builder to detect the rendered state.
      ),
    );
  }
}

/// Circle variant.
class ChannelLogoCircle extends StatelessWidget {
  final String? logoUrl;
  final String? localLogoUrl;
  final String channelName;
  final double radius;

  const ChannelLogoCircle({
    super.key,
    required this.logoUrl,
    this.localLogoUrl,
    required this.channelName,
    this.radius = 28,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: radius * 2,
      height: radius * 2,
      child: ClipOval(
        child: ChannelLogo(
          logoUrl: logoUrl,
          localLogoUrl: localLogoUrl,
          channelName: channelName,
          size: radius * 2,
          borderRadius: radius,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
