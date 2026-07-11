import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shimmer/shimmer.dart';
import 'package:http/http.dart' as http;
import '../constants.dart';
import '../utils/backend_config.dart';

/// Premium channel logo with shimmer loading, cached network image,
/// SVG support, error safety, and a gradient initials fallback.
class ChannelLogo extends StatelessWidget {
  final String? logoUrl;
  final String? localLogoUrl;
  final String channelName;
  final double size;
  final double borderRadius;
  final BoxFit fit;
  final String? cacheKey;
  final Color? backgroundColor;
  final Color? borderColor;
  final String? semanticLabel;

  const ChannelLogo({
    super.key,
    required this.logoUrl,
    this.localLogoUrl,
    required this.channelName,
    this.size = 56,
    this.borderRadius = 8,
    this.fit = BoxFit.contain,
    this.cacheKey,
    this.backgroundColor,
    this.borderColor,
    this.semanticLabel,
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
    final words = trimmed
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return trimmed.length >= 2
        ? trimmed.substring(0, 2).toUpperCase()
        : trimmed[0].toUpperCase();
  }

  bool get _isSvg {
    final url = _imageUrl;
    return url != null && url.toLowerCase().split('?').first.endsWith('.svg');
  }

  bool get _hasValidUrl {
    final url = _imageUrl;
    return url != null && url.trim().isNotEmpty;
  }

  String get _effectiveCacheKey {
    if (cacheKey != null) return cacheKey!;
    final url = _imageUrl ?? channelName;
    return 'logo_${url.hashCode}';
  }

  /// Premium gradient pairs used for the initials fallback. These are
  /// dark, subtle, and consistent with the app theme so the fallback
  /// never looks like a broken image.
  static const List<List<Color>> _fallbackGradients = [
    [Color(0xFF1E1E2E), Color(0xFF2A2A3E)], // slate
    [Color(0xFF0F1A40), Color(0xFF1A1040)], // navy
    [Color(0xFF1A0F3A), Color(0xFF0D1026)], // deep purple
    [Color(0xFF0A2E1F), Color(0xFF0A1F18)], // deep teal
    [Color(0xFF2A1508), Color(0xFF3A240A)], // deep amber
    [Color(0xFF2A0A15), Color(0xFF3A0F0F)], // deep red
  ];

  List<Color> get _fallbackColors {
    final idx = channelName.isEmpty
        ? 0
        : channelName.codeUnitAt(0) % _fallbackGradients.length;
    return _fallbackGradients[idx];
  }

  @override
  Widget build(BuildContext context) {
    Widget child;
    try {
      if (!_hasValidUrl) {
        child = _buildFallback();
      } else if (_isSvg) {
        child = _SvgLogoWidget(
          url: _imageUrl!,
          size: size,
          borderRadius: borderRadius,
          fallback: _buildFallback(),
          shimmer: _buildShimmer(),
        );
      } else {
        child = ClipRRect(
          borderRadius: BorderRadius.circular(borderRadius),
          child: CachedNetworkImage(
            imageUrl: _imageUrl!,
            cacheKey: _effectiveCacheKey,
            width: size,
            height: size,
            fit: fit,
            fadeInDuration: const Duration(milliseconds: 150),
            httpHeaders: const {
              'Referer': 'https://www.google.com',
              'User-Agent':
                  'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
            },
            placeholder: (context, url) => _buildShimmer(),
            errorWidget: (context, url, error) => _buildFallback(),
          ),
        );
      }
    } catch (_) {
      // Defensive: never let logo rendering crash the app.
      child = _buildFallback();
    }

    return Semantics(
      label: semanticLabel ?? 'Logo of $channelName',
      image: true,
      child: child,
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
    final bg = backgroundColor ?? const Color(AppColors.surfaceElevated);
    final border = borderColor ?? const Color(AppColors.divider);
    final colors = _fallbackColors;
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
        border: Border.all(color: border, width: 0.8),
      ),
      alignment: Alignment.center,
      child: Padding(
        padding: EdgeInsets.all(size * 0.12),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            _initials,
            maxLines: 1,
            style: TextStyle(
              color: Colors.white,
              fontSize: size * 0.34,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              shadows: const [
                Shadow(
                  blurRadius: 6,
                  color: Colors.black54,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Handles SVG loading with error safety. `flutter_svg` has no
/// `errorBuilder`, so we combine a timeout with a defensive try/catch
/// around the build to guarantee a fallback is always rendered.
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
  bool _isLoading = true;
  String? _svgString;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();
    _fetchSvg();
    // If the SVG hasn't loaded within 8 seconds, show the fallback.
    _timeoutTimer = Timer(const Duration(seconds: 8), () {
      if (mounted && _isLoading) setState(() { _svgFailed = true; _isLoading = false; });
    });
  }

  Future<void> _fetchSvg() async {
    try {
      final response = await http.get(
        Uri.parse(widget.url),
        headers: {
          'Referer': 'https://www.google.com',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        },
      );
      if (response.statusCode == 200) {
        // Strip common vector editor tags that cause flutter_svg console spam
        String cleanSvg = response.body
            .replaceAll(RegExp(r'<metadata.*?>.*?</metadata>', dotAll: true), '')
            .replaceAll(RegExp(r'<metadata\s*/>', dotAll: true), '')
            .replaceAll(RegExp(r'<sodipodi:namedview.*?>.*?</sodipodi:namedview>', dotAll: true), '')
            .replaceAll(RegExp(r'<sodipodi:namedview\s*/>', dotAll: true), '')
            .replaceAll(RegExp(r'<defs\s*/>', dotAll: true), '');

        if (mounted) {
          setState(() {
            _svgString = cleanSvg;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() { _svgFailed = true; _isLoading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _svgFailed = true; _isLoading = false; });
    }
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_svgFailed) return widget.fallback;
    if (_isLoading || _svgString == null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(widget.borderRadius),
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: widget.shimmer,
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: SvgPicture.string(
          _svgString!,
          fit: BoxFit.contain,
        ),
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
  final String? semanticLabel;

  const ChannelLogoCircle({
    super.key,
    required this.logoUrl,
    this.localLogoUrl,
    required this.channelName,
    this.radius = 28,
    this.semanticLabel,
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
          semanticLabel: semanticLabel,
        ),
      ),
    );
  }
}
