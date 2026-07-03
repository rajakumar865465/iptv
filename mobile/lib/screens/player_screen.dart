import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:shimmer/shimmer.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:share_plus/share_plus.dart';
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
import '../models/channel_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/channel_logo.dart';
import '../cubits/license_cubit.dart';
import '../utils/backend_config.dart';

enum PlayerSourceType {
  homeFeatured,
  homePopular,
  liveTv,
  category,
  search,
  favorites,
  related,
  moreLive,
}

class ChannelSourceFilters {
  final int? categoryId;
  final String? categoryName;
  final String? language;
  final String? searchQuery;
  final bool workingOnly;
  final String sort;
  final bool? premium;

  const ChannelSourceFilters({
    this.categoryId,
    this.categoryName,
    this.language,
    this.searchQuery,
    this.workingOnly = true,
    this.sort = 'recommended',
    this.premium,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> map = {};
    if (categoryId != null && categoryId != 0) {
      map['categoryId'] = categoryId.toString();
    }
    if (categoryName != null && categoryName!.isNotEmpty) {
      map['category'] = categoryName;
    }
    if (language != null && language!.isNotEmpty) {
      map['language'] = language;
    }
    if (searchQuery != null && searchQuery!.isNotEmpty) {
      map['search'] = searchQuery;
    }
    map['workingOnly'] = workingOnly ? 'true' : 'false';
    if (sort.isNotEmpty && sort != 'recommended') {
      map['sort'] = sort;
    }
    if (premium != null) {
      map['premium'] = premium.toString();
    }
    return map;
  }
}

class PlayerScreen extends StatefulWidget {
  final ChannelModel channel;
  final List<ChannelModel> channels;
  final int initialIndex;
  final PlayerSourceType sourceType;
  final ChannelSourceFilters sourceFilters;

  const PlayerScreen({
    super.key,
    required this.channel,
    required this.channels,
    required this.initialIndex,
    required this.sourceType,
    required this.sourceFilters,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

// ----
// Playback Profile System
// Uses media_kit / libmpv tuning only. No ExoPlayer/Media3 assumptions.
// Do NOT use seek() for live stream recovery - always reopen via _initializePlayer.
// ----

enum PlaybackMode { auto, stable, fast, dataSaver }

class PlaybackProfile {
  final String name;
  /// Seconds of content to buffer ahead (libmpv demuxer-readahead-secs)
  final int demuxerReadaheadSecs;
  /// Max RAM buffer size in bytes (media_kit PlayerConfiguration.bufferSize)
  final int bufferSizeBytes;
  /// Seconds before first videoParams = startup failure
  final int startupTimeoutSecs;
  /// Seconds of sustained buffering before retry cascade begins
  final int stallTimeoutSecs;
  /// Default quality override when Data Saver is active
  final String preferredQuality;
  const PlaybackProfile({
    required this.name,
    required this.demuxerReadaheadSecs,
    required this.bufferSizeBytes,
    required this.startupTimeoutSecs,
    required this.stallTimeoutSecs,
    required this.preferredQuality,
  });
}

/// Stable (default): safe for most IPTV channels.
/// Larger buffer keeps player well behind live edge - avoids 404 on fresh segments.
const PlaybackProfile kStableProfile = PlaybackProfile(
  name: 'stable',
  demuxerReadaheadSecs: 30,
  bufferSizeBytes: 64 * 1024 * 1024, // 64 MB
  startupTimeoutSecs: 25,
  stallTimeoutSecs: 30,
  preferredQuality: 'auto',
);

/// Fast: lower latency, for known-stable channels only.
const PlaybackProfile kFastProfile = PlaybackProfile(
  name: 'fast',
  demuxerReadaheadSecs: 10,
  bufferSizeBytes: 16 * 1024 * 1024, // 16 MB
  startupTimeoutSecs: 15,
  stallTimeoutSecs: 18,
  preferredQuality: 'auto',
);

/// Data Saver: moderate buffer, starts at lower quality.
const PlaybackProfile kDataSaverProfile = PlaybackProfile(
  name: 'data_saver',
  demuxerReadaheadSecs: 20,
  bufferSizeBytes: 32 * 1024 * 1024, // 32 MB
  startupTimeoutSecs: 25,
  stallTimeoutSecs: 30,
  preferredQuality: '360p',
);

// ----

class _PlayerScreenState extends State<PlayerScreen> with TickerProviderStateMixin {
  final ApiService _api = ApiService();
  // Fix #1: Use media_kit Player instead of VideoPlayerController for proper HLS support
  late final Player _player;
  late final VideoController _videoController;
  bool _isLoading = true;
  bool _hasError = false;
  bool _isFullScreen = false;
  bool _showControls = true;
  String _currentUrl = '';
  late int _currentIndex;
  late List<ChannelModel> _contextChannels;
  late PlayerSourceType _sourceType;
  late ChannelSourceFilters _sourceFilters;
  bool _hasMoreBefore = false;
  bool _hasMoreAfter = true;
  int _previousPage = 1;
  int _nextPage = 1;
  Timer? _controlsTimer;
  final GlobalKey _videoKey = GlobalKey();

  List<dynamic> _backupStreams = [];
  Map<String, dynamic>? _currentStreamMeta;
  bool _isRetryingStream = false;
  String _streamOverlayMessage = '';
  Timer? _bufferTimer;
  Timer? _startupTimer;
  Timer? _reconnectTimer;
  int _retryAttempt = 0;
  StreamSubscription? _playerSubscription;
  StreamSubscription? _playerErrorSubscription;
  StreamSubscription? _videoParamsSubscription;
  bool _hadFailureBeforePlaying = false;

  // Fix #4: Prevent multiple error callbacks from firing simultaneously.
  // media_kit can fire multiple error events rapidly during HLS init; without this guard
  // each spawns its own 3s delayed failure call, exhausting backup streams prematurely.
  bool _playerErrorPending = false;
  Timer? _errorGraceTimer;

  // Fix #18: Track when video actually starts playing to compute accurate watch_duration
  DateTime? _playStartTime;

  // ---- Playback Profile (Phase 4) ----
  PlaybackMode _playbackMode = PlaybackMode.auto;
  PlaybackProfile get _activeProfile {
    switch (_playbackMode) {
      case PlaybackMode.fast:      return kFastProfile;
      case PlaybackMode.dataSaver: return kDataSaverProfile;
      case PlaybackMode.auto:
      case PlaybackMode.stable:    return kStableProfile;
    }
  }

  // Proxy fallback state - populated from playback API response
  String? _proxyUrl;
  bool _proxyAttempted = false;

  // Smooth Playback / Delayed Live state
  bool _smoothPlaybackEnabled = false;
  bool _bufferReady = false;
  int _delaySeconds = 0;
  String _bufferStatus = '';
  String? _fallbackDirectUrl;
  bool _showPreparingOverlay = false;

  // Auto quality upgrade state
  bool _wasQualityDowngraded = false;
  Timer? _qualityUpgradeTimer;
  bool _qualityUpgradeLocked = false; // locked for session after failed upgrade

  // Video Quality state
  List<dynamic> _qualities = [];
  Map<String, dynamic>? _selectedQuality;
  bool _dataSaverEnabled = false;
  String _defaultQualityPref = 'auto';
  bool _autoMobileData = true;
  bool _hdOnlyWifi = true;
  bool _isOnMobileData = false;
  String _fitMode = 'auto';
  bool _rememberFitModeForChannel = false;
  // Per-channel smart display: auto-detected aspect ratio from stream
  String? _autoDetectedFitMode;
  String _detectedAspectRatioType = 'unknown';
  int? _detectedVideoWidth;
  int? _detectedVideoHeight;
  // Animation controller for controls fade
  late AnimationController _controlsAnimController;
  late Animation<double> _controlsOpacity;

  // EPG & Related
  EpgProgram? _nowPlaying;
  List<EpgProgram> _upcoming = [];
  List<ChannelModel> _relatedChannels = [];
  bool _loadingEPG = false;
  bool _loadingRelated = false;
  String _relatedSourceType = '';

  // More Live Channels pagination
  final ScrollController _scrollController = ScrollController();
  List<ChannelModel> _moreLiveChannels = [];

  /// True if the current user has an active premium license with transcode access (duration > 1 day)
  bool get _isPremium {
    final s = context.read<LicenseCubit>().state;
    if (s is! LicenseActive) return false;
    return s.license.isPremium; // isPremium = durationDays > 1
  }
  bool _moreLoading = false;

  final List<DateTime> _bufferingEvents = [];

  // Slow connection overlay
  bool _showSlowConnectionOverlay = false;
  bool _slowOverlaySuppressedForSession = false;
  DateTime? _lastSlowWarningAt;
  Timer? _slowOverlayTimer;

  // In-player toast (replaces quality-switch SnackBars)
  String _playerToast = '';
  Timer? _playerToastTimer;

  @override
  void initState() {
    super.initState();
    _contextChannels = List<ChannelModel>.from(widget.channels);
    _currentIndex = widget.initialIndex;
    if (_currentIndex < 0 || _currentIndex >= _contextChannels.length) {
      _currentIndex = _contextChannels.indexWhere((c) => c.id == widget.channel.id);
      if (_currentIndex < 0) {
        _contextChannels.insert(0, widget.channel);
        _currentIndex = 0;
      }
    }
    _sourceType = widget.sourceType;
    _sourceFilters = widget.sourceFilters;

    // Calculate initial page limits
    final limit = 50; // standard limit
    _nextPage = (_contextChannels.length / limit).ceil() + 1;
    _previousPage = 1;
    _hasMoreBefore = false;
    _hasMoreAfter = _sourceType == PlayerSourceType.liveTv ||
                     _sourceType == PlayerSourceType.category ||
                     _sourceType == PlayerSourceType.search;

    _currentUrl = _currentChannel.streamUrl;

    // Fix #1: Initialize media_kit player with optimized Netflix-style fast-start configuration
    _player = Player(
      configuration: PlayerConfiguration(
        // Match the stable profile at startup. libmpv readahead is tuned per stream below.
        bufferSize: kStableProfile.bufferSizeBytes,
        // Disable pitch shifting to save CPU during startup
        pitch: false,
      ),
    );
    _videoController = VideoController(_player);

    // Fix #9: Keep screen on during playback
    WakelockPlus.enable();

    _controlsAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _controlsOpacity = CurvedAnimation(parent: _controlsAnimController, curve: Curves.easeInOut);
    _controlsAnimController.forward();

    context.read<FavoriteCubit>().loadFavorites();
    _scrollController.addListener(_onScroll);
    _loadQualitySettingsAndFetch();
    _loadChannelData();
    _updateMoreChannelsFromContext();
  }

  // ------------------------ Player ------------------------

  Future<void> _loadQualitySettingsAndFetch() async {
    final storage = StorageService();
    _defaultQualityPref = await storage.getVideoQualityPreference();
    _dataSaverEnabled = await storage.isDataSaverEnabled();
    _autoMobileData = await storage.isAutoQualityOnMobileData();
    _hdOnlyWifi = await storage.isHdOnlyOnWifi();

    // Load playback mode from user preferences
    final modeStr = await storage.getPlaybackMode();
    _playbackMode = PlaybackMode.values.firstWhere(
      (e) => e.name == modeStr,
      orElse: () => PlaybackMode.auto,
    );
    // Data Saver mode: cap quality preference to 480p
    if (_playbackMode == PlaybackMode.dataSaver) {
      if (_defaultQualityPref == 'auto' ||
          _defaultQualityPref == '1080p' ||
          _defaultQualityPref == '720p') {
        _defaultQualityPref = '480p';
      }
    }

    await _resolveFitMode();

    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      _isOnMobileData = connectivityResult.contains(ConnectivityResult.mobile);
    } catch (_) {}

    _fetchPlaybackAndInitialize();
  }

  static const Set<String> _validFitModes = {'auto', 'fit', 'fill', 'zoom', 'stretch'};

  String _normalizeFitMode(String? mode) {
    final value = (mode ?? '').trim().toLowerCase();
    if (value == 'original' || value == 'contain') return 'fit';
    if (value == 'safefill' || value == 'cover') return 'fill';
    if (_validFitModes.contains(value)) return value;
    return 'auto';
  }

  bool _isCropMode(String mode) => mode == 'fill' || mode == 'zoom';

  String _effectiveFitMode() {
    final normalized = _normalizeFitMode(_fitMode);
    return normalized == 'auto' ? _getRecommendedFitMode() : normalized;
  }

  Future<void> _saveFitModePreference() async {
    final storage = StorageService();
    final mode = _normalizeFitMode(_fitMode);
    if (_rememberFitModeForChannel) {
      await storage.setChannelFitMode(_currentChannel.id, mode);
    } else {
      await storage.setVideoFitMode(mode);
    }
  }

  /// Resolve the best fit mode for the current channel using the 5-level priority chain:
  /// 1. User saved mode for this channel
  /// 2. Admin/backend recommended mode for this channel
  /// 3. Global default mode
  /// 4. Auto recommendation from stream dimensions
  /// 5. Safe fallback = Auto
  Future<void> _resolveFitMode() async {
    final storage = StorageService();

    if (await storage.hasChannelFitMode(_currentChannel.id)) {
      _fitMode = _normalizeFitMode(await storage.getChannelFitMode(_currentChannel.id));
      _rememberFitModeForChannel = true;
      return;
    }

    _rememberFitModeForChannel = false;

    if (_currentChannel.defaultFitMode != 'original' &&
        _currentChannel.defaultFitMode != 'unknown' &&
        _currentChannel.defaultFitMode.isNotEmpty) {
      _fitMode = _normalizeFitMode(_currentChannel.defaultFitMode);
      if (_isNewsChannel && _isCropMode(_effectiveFitMode())) {
        _fitMode = 'fit';
      }
      return;
    }

    _fitMode = _normalizeFitMode(await storage.getVideoFitMode());
    if (_isNewsChannel && _isCropMode(_effectiveFitMode())) {
      _fitMode = 'auto';
    }
  }

  /// Whether the current channel is a news channel that should never be cropped by default
  bool get _isNewsChannel {
    final cat = (_currentChannel.categoryName ?? '').toLowerCase();
    final name = _currentChannel.name.toLowerCase();
    return cat.contains('news') || name.contains('news') || name.contains('tak') || name.contains('aaj');
  }

  /// Detect aspect ratio from the video stream and set auto-detected fit mode
  void _detectAspectRatio({int? paramsWidth, int? paramsHeight}) {
    // Prefer explicit params from videoParams stream, fallback to player.state
    final w = paramsWidth ?? _player.state.width;
    final h = paramsHeight ?? _player.state.height;
    if (w == null || h == null || w == 0 || h == 0) return;

    _detectedVideoWidth = w;
    _detectedVideoHeight = h;
    final ratio = w / h;

    if ((ratio - 16 / 9).abs() < 0.05) {
      _detectedAspectRatioType = '16:9';
    } else if ((ratio - 4 / 3).abs() < 0.05) {
      _detectedAspectRatioType = '4:3';
    } else if (ratio > 2.0) {
      _detectedAspectRatioType = 'wide';
    } else if (ratio < 1.0) {
      _detectedAspectRatioType = 'vertical';
    } else {
      _detectedAspectRatioType = 'unusual';
    }

    // Auto-detect recommended fit mode (priority 3)
    // Don't override if user or server already set a mode
    if (_rememberFitModeForChannel) return;
    if (_currentChannel.defaultFitMode != 'original' &&
        _currentChannel.defaultFitMode != 'unknown' &&
        _currentChannel.defaultFitMode.isNotEmpty) return;

    if (_isNewsChannel || _detectedAspectRatioType == '4:3' || _detectedAspectRatioType == 'vertical') {
      _autoDetectedFitMode = 'fit';
    } else if (_currentChannel.hasInternalBlackBars) {
      _autoDetectedFitMode = 'zoom';
    } else {
      _autoDetectedFitMode = 'fill';
    }

    if (_normalizeFitMode(_fitMode) == 'auto') {
      _fitMode = 'auto';
    }


    // Report detected aspect ratio to backend for admin visibility
    _reportDisplayInfo();

    if (mounted) setState(() {});
  }

  /// Returns why the current fit mode is active
  String _getFitModeSource() {
    if (_rememberFitModeForChannel) return 'Your saved preference';
    if (_currentChannel.defaultFitMode != 'original' &&
        _currentChannel.defaultFitMode != 'unknown' &&
        _currentChannel.defaultFitMode.isNotEmpty) return 'Admin recommended';
    if (_autoDetectedFitMode != null) return 'Auto-detected';
    return 'Global default';
  }

  /// Report detected display info to backend for admin visibility
  Future<void> _reportDisplayInfo() async {
    try {
      await _api.post(ApiEndpoints.channelDisplayReportPath(_currentChannel.id), {
        'aspect_ratio_type': _detectedAspectRatioType,
        'video_width': _detectedVideoWidth,
        'video_height': _detectedVideoHeight,
        'detected_fit_mode': _autoDetectedFitMode,
      });
    } catch (_) {}
  }

  Map<String, dynamic>? _determineInitialQuality() {
    if (_qualities.isEmpty) return null;

    bool restrictToSD = _dataSaverEnabled || (_autoMobileData && _isOnMobileData);
    bool blockHD = _hdOnlyWifi && _isOnMobileData;

    List<dynamic> allowed = _qualities.where((q) {
      if (q['type'] == 'auto') return restrictToSD == false; // Prefer explicit SD variants if restricted
      int h = q['height'] ?? 0;
      if (restrictToSD && h > 480) return false;
      if (blockHD && h >= 720) return false;
      return true;
    }).toList();

    if (allowed.isEmpty) allowed = _qualities; // Fallback

    String targetLabel = _defaultQualityPref;
    if (_dataSaverEnabled) targetLabel = '240p'; // Data saver defaults to lowest
    else if (restrictToSD) targetLabel = '360p'; // Auto mobile defaults to medium-low

    if (targetLabel == 'auto') {
      return allowed.firstWhere((q) => q['type'] == 'auto', orElse: () => allowed.first);
    } else {
      for (var q in allowed) {
        if (q['type'] == 'auto') continue;
        if (q['label'] == targetLabel) return q;
      }
      return allowed.firstWhere((q) => q['type'] == 'auto', orElse: () => allowed.last);
    }
  }

  Future<void> _fetchSmoothPlayback() async {
    try {
      final res = await _api.get(ApiEndpoints.channelSmoothPlaybackPath(_currentChannel.id));
      if (res['success'] == true) {
        final d = res['data'];
        final mode = d['playback_mode'] as String? ?? 'direct';
        if (mode == 'delayed') {
          _smoothPlaybackEnabled = true;
          _delaySeconds = (d['delay_seconds'] as num?)?.toInt() ?? 300;
          _bufferReady = d['buffer_ready'] == true;
          _bufferStatus = d['buffer_status'] as String? ?? 'warming_up';
          _fallbackDirectUrl = d['fallback_direct_url'] as String?;
          final statusMessage = d['message'] as String?;

          if (_bufferReady) {
            // Override stream URL with delayed buffer URL
            final delayedUrl = d['delayed_stream_url'] as String?;
            if (delayedUrl != null && delayedUrl.isNotEmpty) {
              _currentStreamMeta = {'url': delayedUrl, 'headers': {}};
              if (mounted) setState(() { _showPreparingOverlay = false; });
            }
          } else {
            // Buffer warming up — show preparing overlay with status message
            if (mounted) {
              setState(() {
                _showPreparingOverlay = true;
                _streamOverlayMessage = statusMessage ?? 'Preparing smooth playback...';
              });
            }
            
            // Show specific status messages based on buffer status
            if (_bufferStatus == 'source_timeout' || _bufferStatus == 'trying_backup') {
              _streamOverlayMessage = statusMessage ?? 'Trying another source...';
            } else if (_bufferStatus == 'no_working_source') {
              _streamOverlayMessage = statusMessage ?? 'No stable source is available right now.';
            } else if (_bufferStatus == 'backup_active') {
              _streamOverlayMessage = 'Using backup source...';
            }
          }
        } else if (mode == 'requires_licensed_source') {
          _smoothPlaybackEnabled = true;
          _bufferReady = false;
          _bufferStatus = 'requires_licensed_source';
          _showPreparingOverlay = false;
          _streamOverlayMessage = d['message'] as String? ?? 'No stable source is available right now.';
        } else {
          _smoothPlaybackEnabled = false;
          _showPreparingOverlay = false;
        }
      }
    } catch (_) {
      // Smooth playback info unavailable — continue with direct stream
      _smoothPlaybackEnabled = false;
    }
  }

  Future<void> _fetchPlaybackAndInitialize() async {
    // Fix #3: Cancel any pending buffer timer before starting a new stream to prevent
    // the old channel's timeout from firing and setting _isRetryingStream on the new one.
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _startupTimer?.cancel();
    _startupTimer = null;
    _playerSubscription?.cancel();
    _playerSubscription = null;
    _playerErrorSubscription?.cancel();
    _playerErrorSubscription = null;
    _videoParamsSubscription?.cancel();
    _videoParamsSubscription = null;

    // Reset proxy + upgrade state for new channel
    _proxyUrl = null;
    _proxyAttempted = false;
    _wasQualityDowngraded = false;
    _hadFailureBeforePlaying = false;
    _qualityUpgradeTimer?.cancel();
    _qualityUpgradeTimer = null;

    if (mounted) setState(() { _isLoading = true; _hasError = false; _streamOverlayMessage = 'Loading channel...'; _isRetryingStream = false; });
    try {
      final res = await _api.get(ApiEndpoints.channelPlaybackPath(_currentChannel.id));
      if (res['success'] == true) {
        final data = res['data'];
        _currentStreamMeta = data['primary_stream'];
        _backupStreams = List<dynamic>.from(data['backup_streams'] ?? []);
        _qualities = List<dynamic>.from(data['qualities'] ?? []);

        // Parse new fields from enhanced playback API
        // proxy_url is null when DRM/geo-blocked/hidden/unlicensed — never try proxy then
        _proxyUrl = data['proxy_url'] as String?;

        // Fetch smooth playback info and override URL if delayed buffer is ready
        await _fetchSmoothPlayback();
        if (_smoothPlaybackEnabled &&
            (_bufferStatus == 'no_working_source' || _bufferStatus == 'requires_licensed_source')) {
          if (mounted) {
            setState(() {
              _isLoading = false;
              _hasError = true;
              _showPreparingOverlay = false;
              _streamOverlayMessage = 'No stable source is available right now.';
            });
          }
          return;
        }

        // Backend may recommend 'fast' profile for known-stable high-health streams
        final serverProfile = data['recommended_buffer_profile'] as String? ?? 'stable';
        // Only apply server recommendation if user is in Auto mode
        if (_playbackMode == PlaybackMode.auto && serverProfile == 'fast') {
          // Silently use fast profile for this channel (user preference stays Auto)
          // We do this by NOT overriding _activeProfile since auto maps to stable,
          // but we track it for the buffering timer below.
          // Note: don't change _playbackMode — just use faster timers if server says fast.
        }

        _selectedQuality = _determineInitialQuality();

        // Fix #3: Guard against null _currentStreamMeta before accessing with !.
        final String urlToPlay;
        final Map<String, dynamic>? headersToUse;
        if (_selectedQuality != null && _selectedQuality!['url'] != null) {
          urlToPlay = _selectedQuality!['url'];
          headersToUse = _selectedQuality!['headers'];
        } else if (_currentStreamMeta != null && _currentStreamMeta!['url'] != null) {
          urlToPlay = _currentStreamMeta!['url'];
          headersToUse = _currentStreamMeta!['headers'];
        } else {
          throw Exception('No stream URL in playback response');
        }
        await _initializePlayer(urlToPlay, headersToUse);
      } else {
        throw Exception('Playback fetch failed');
      }
    } catch(e) {
      _backupStreams = _currentChannel.backupStreamUrl?.isNotEmpty == true ? [
        {'url': _currentChannel.backupStreamUrl, 'headers': { 'User-Agent': _currentChannel.userAgent, 'Referer': _currentChannel.referrer }}
      ] : [];
      await _initializePlayer(_currentChannel.streamUrl, {
        if (_currentChannel.userAgent != null) 'User-Agent': _currentChannel.userAgent!,
        if (_currentChannel.referrer != null) 'Referer': _currentChannel.referrer!,
      });
    }
  }

  Future<void> _initializePlayer(String url, [Map<String, dynamic>? rawHeaders, Duration? startPosition]) async {
    _currentUrl = url;
    _playerSubscription?.cancel();
    _playerSubscription = null;
    _playerErrorSubscription?.cancel();
    _playerErrorSubscription = null;
    _videoParamsSubscription?.cancel();
    _videoParamsSubscription = null;
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _startupTimer?.cancel();
    _startupTimer = null;
    // Fix #4: Cancel any pending error grace timer when reinitializing — prevents a delayed
    // error from a previous stream from triggering failure on the newly loaded stream.
    _errorGraceTimer?.cancel();
    _errorGraceTimer = null;
    _playerErrorPending = false;
    _playStartTime = null;
    if (mounted) setState(() { _isLoading = true; _hasError = false; if (_streamOverlayMessage.isEmpty) _streamOverlayMessage = 'Loading channel...'; });

    try {
      // -- Apply profile-based libmpv tuning --------------------------------
      // media_kit / libmpv only. No ExoPlayer/Media3. No seek() on live streams.
      final profile = _activeProfile;
      try {
        final platform = _player.platform;
        if (platform.runtimeType.toString().contains('NativePlayer') ||
            platform.runtimeType.toString().contains('LibmpvPlayer')) {
          // Larger readahead keeps player behind live edge, reducing segment 404s
          await (platform as dynamic).setProperty(
              'demuxer-readahead-secs', '${profile.demuxerReadaheadSecs}');
          await (platform as dynamic).setProperty(
              'cache-secs', '${profile.demuxerReadaheadSecs}');
          await (platform as dynamic).setProperty('cache', 'yes');
          // Auto-reconnect on network stall — never use seek() on live streams
          await (platform as dynamic).setProperty(
              'stream-lavf-o',
              'reconnect=1,reconnect_at_eof=1,reconnect_streamed=1,'
              'reconnect_delay_max=4,timeout=20000000');
          await (platform as dynamic).setProperty('network-timeout', '20');
        }
      } catch (_) {
        // setProperty not available on this platform — safe to ignore
      }

      final Map<String, String> headers = {};
      if (rawHeaders != null) {
        rawHeaders.forEach((k, v) {
          if (v != null && v.toString().isNotEmpty) headers[k] = v.toString();
        });
      }

      final media = Media(url, httpHeaders: headers.isNotEmpty ? headers : null);

      // Fix: Use open(play: true) — removes redundant play() call
      // IMPORTANT: Do NOT seek() for live stream recovery — it can jump to the beginning
      // or fail outright. Let libmpv start from the live edge via reconnect=1.
      await _player.open(media, play: true);

      // -- Listen for buffering changes ----------------------------------
      _playerSubscription = _player.stream.buffering.listen(_onBufferingChanged);

      // -- Listen for errors ---------------------------------------------
      // media_kit fires error events during normal HLS playlist resolution
      // (e.g. "Failed to open" before retrying internally). We add a small
      // grace delay so transient init errors don't trigger failure immediately.
      //
      // Fix #4: Guard with _playerErrorPending flag — media_kit can fire many error
      // events rapidly. Without this, each spawns a separate delayed failure call that
      // can race with each other and exhaust backup streams in one burst.
      _playerErrorSubscription = _player.stream.error.listen((errorMsg) {
        if (errorMsg.isEmpty || !mounted) return;
        if (_playerErrorPending) return; // already have a pending error call — skip duplicate
        _playerErrorPending = true;
        _errorGraceTimer = Timer(const Duration(seconds: 3), () {
          _playerErrorPending = false;
          _errorGraceTimer = null;
          if (!mounted || !_isLoading) return; // already playing — ignore
          _handleStreamFailure('player_error');
        });
      });

      // -- Wait for actual video to be ready -----------------------------
      // 'playing' becomes true instantly, but 'videoParams' only updates
      // when the video stream is actually parsed and ready to render.
      _videoParamsSubscription = _player.stream.videoParams
          .where((p) => p.w != null && p.w! > 0)
          .listen((params) {
        if (!mounted || params.w == null) return;
        _videoParamsSubscription?.cancel();
        _videoParamsSubscription = null;
        _startupTimer?.cancel();
        _startupTimer = null;

          // Force HD/highest quality native track automatically to improve sharpness
          // like a paid Live TV app, unless restricted by data saver settings.
          final nativeTracks = _player.state.tracks.video;
          if (nativeTracks.length > 2 && !_dataSaverEnabled && !(_hdOnlyWifi && _isOnMobileData)) {
            try {
              final bestTrack = nativeTracks
                  .where((t) => t.id != 'auto' && t.id != 'no' && t.h != null)
                  .reduce((a, b) => (a.h ?? 0) > (b.h ?? 0) ? a : b);
              if (bestTrack.h != null && bestTrack.h! >= 720) {
                _player.setVideoTrack(bestTrack);
              }
            } catch (_) {}
          }

          setState(() {
            _isLoading = false;
            _isRetryingStream = false;
            _streamOverlayMessage = '';
          });
          // Fix #18: Record when the video actually starts so we can compute accurate watch_duration
          _playStartTime = DateTime.now();
          // Detect aspect ratio and re-resolve fit mode from stream dimensions
          _detectAspectRatio(paramsWidth: params.w, paramsHeight: params.h);
          _retryAttempt = 0; // reset retry counter on success
          _showControlsWithTimer();
          // Report playback result to backend
          _reportPlaybackSuccess();
          // Start auto quality upgrade timer if quality was previously downgraded
          _startAutoUpgradeTimerIfNeeded();
          // Fallback: retry detection after delay (web platforms may populate dimensions late)
          Future.delayed(const Duration(seconds: 3), () {
            if (mounted && _detectedAspectRatioType == 'unknown') {
              _detectAspectRatio();
            }
          });
      });

      // -- Safety startup timeout (profile-based) ---------------------------
      // Stable/DataSaver=25s, Fast=15s — avoids false errors on slow streams
      _startupTimer = Timer(Duration(seconds: profile.startupTimeoutSecs), () {
        if (mounted && _isLoading && !_hasError) {
          _handleStreamFailure('init_timeout');
        }
      });

    } catch (e) {
      _handleStreamFailure('init_failed');
    }
  }

  /// Start the auto quality-upgrade timer after stable playback,
  /// only when Auto mode is active and quality was previously downgraded.
  void _startAutoUpgradeTimerIfNeeded() {
    if (!_wasQualityDowngraded) return;
    if (_qualityUpgradeLocked) return;
    if (_playbackMode != PlaybackMode.auto) return;
    _qualityUpgradeTimer?.cancel();
    _qualityUpgradeTimer = Timer(const Duration(minutes: 3), _tryUpgradeQuality);
  }

  /// After 3 minutes of stable playback, silently try one step higher quality.
  /// If it causes buffering within 30 s, lock at current quality for this session.
  Future<void> _tryUpgradeQuality() async {
    if (!mounted || _qualityUpgradeLocked || !_wasQualityDowngraded) return;
    final currentHeight = (_selectedQuality?['height'] as num?)?.toInt() ?? 0;
    if (currentHeight <= 0) return;

    // Find the next step up from the current quality
    Map<String, dynamic>? higher;
    for (final q in _qualities) {
      if (q['type'] == 'auto') continue;
      final h = (q['height'] as num?)?.toInt() ?? 0;
      if (h > currentHeight) {
        if (higher == null || h < ((higher['height'] as num?)?.toInt() ?? 99999)) {
          higher = q;
        }
      }
    }
    if (higher == null) return;

    final upgradeHeight = higher['height'];
    _showPlayerToast('Trying better quality (${upgradeHeight}p)...');
    await _autoSwitchQualityQuietly(higher);

    // If buffering starts within 30 s after upgrade, lock quality for this session
    Timer(const Duration(seconds: 30), () {
      if (mounted && _isLoading) {
        _qualityUpgradeLocked = true;
        _wasQualityDowngraded = false;
        _qualityUpgradeTimer?.cancel();
      }
    });
  }

  // Fix #2: Buffering timer - only fires after sustained buffering, not on initial load.
  // When the player first opens an HLS stream it is always buffering. We only
  // treat it as a failure if buffering lasts beyond the grace period.
  void _onBufferingChanged(bool isBuffering) {
    if (isBuffering) {
      // Start a buffer-stall timer only if we were already playing (not initial load).
      // For initial load the 30-second safety timeout in _initializePlayer covers us.
      final alreadyStarted = !_isLoading;
      if (alreadyStarted) {
        final now = DateTime.now();
        _bufferingEvents.add(now);
        _bufferingEvents.removeWhere((t) => now.difference(t).inSeconds > 60);

        if (_bufferingEvents.length >= 3 && !_currentUrl.contains('/api/stream/transcode/')) {
          _showNetworkSlowPrompt();
          _bufferingEvents.clear();
        }

        // Show "Reconnecting..." overlay message after 3 seconds of sustained buffering
        _reconnectTimer?.cancel();
        _reconnectTimer = Timer(const Duration(seconds: 3), () {
          if (mounted && alreadyStarted) {
            setState(() {
              _streamOverlayMessage = 'Reconnecting...';
              _isLoading = true;
            });
          }
        });

        // Profile-based stall timeout - Stable/DataSaver=30s, Fast=18s.
        // Mobile data in weak-signal areas can stall 15-20s and self-recover.
        _bufferTimer ??= Timer(Duration(seconds: _activeProfile.stallTimeoutSecs), () {
          if (mounted) _handleStreamFailure('buffer_timeout');
        });
      }
    } else {
      // Buffering cleared - cancel stall/reconnect timers and clear loading spinner
      _bufferTimer?.cancel();
      _bufferTimer = null;
      _reconnectTimer?.cancel();
      _reconnectTimer = null;
      if (mounted && _isLoading) {
        setState(() {
          _isLoading = false;
          _isRetryingStream = false;
          _streamOverlayMessage = '';
        });
        _retryAttempt = 0; // reset retry counter on success
        _showControlsWithTimer();
      }
      // Hide slow connection overlay when playback resumes
      _hideSlowConnectionOverlay();
    }
  }

  void _showNetworkSlowPrompt() {
    if (!mounted) return;

    // Guard: cooldown (60s) and session suppression
    final now = DateTime.now();
    if (_slowOverlaySuppressedForSession) return;
    if (_lastSlowWarningAt != null && now.difference(_lastSlowWarningAt!).inSeconds < 60) return;

    final lowerQuality = _findLowerQuality();
    final canSwitchQuality = lowerQuality != null;
    final canSwitchTranscode = _isPremium && !_currentUrl.contains('/api/stream/transcode/');

    if (!canSwitchQuality && !canSwitchTranscode) return;

    _lastSlowWarningAt = now;

    // Auto quality mode: switch silently without bothering the user
    if (_defaultQualityPref == 'auto' && canSwitchQuality) {
      _autoSwitchQualityQuietly(lowerQuality!);
      return;
    }

    // Manual mode: show dark in-player overlay prompt
    setState(() { _showSlowConnectionOverlay = true; });
    _slowOverlayTimer?.cancel();
    _slowOverlayTimer = Timer(const Duration(seconds: 5), _hideSlowConnectionOverlay);
  }

  void _hideSlowConnectionOverlay() {
    _slowOverlayTimer?.cancel();
    if (mounted) setState(() { _showSlowConnectionOverlay = false; });
  }

  Future<void> _autoSwitchQualityQuietly(Map<String, dynamic> lowerQuality) async {
    final label = lowerQuality['label'] as String? ?? 'lower quality';
    _showPlayerToast('Optimizing playback -> $label');
    setState(() {
      _selectedQuality = lowerQuality;
      _streamOverlayMessage = 'Optimizing playback...';
      _isLoading = true;
      _hasError = false;
    });
    _isRetryingStream = false;
    await _initializePlayer(
      lowerQuality['url'],
      lowerQuality['headers'] ?? _currentStreamMeta?['headers'] ?? {},
    );
  }

  void _showPlayerToast(String msg) {
    _playerToastTimer?.cancel();
    if (mounted) setState(() { _playerToast = msg; });
    _playerToastTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() { _playerToast = ''; });
    });
  }

  Future<void> _switchToTranscode() async {
    setState(() { _streamOverlayMessage = 'Switching to proxy stream...'; _isLoading = true; _hasError = false; });
    _isRetryingStream = false;
    try {
      final token = await StorageService().getToken() ?? '';
      if (token.isEmpty) throw Exception('No token');
      // Fix #14: Send token in Authorization header instead of URL query param.
      // Query param tokens appear in server logs, browser history, and analytics tools.
      // The backend already prefers Authorization header (streamController.js line 22).
      final fallbackUrl = '${BackendConfig.baseUrl}${ApiEndpoints.streamTranscodePath(_currentChannel.id, quality: '360')}';
      final transcodeHeaders = {'Authorization': 'Bearer $token'};
      _currentStreamMeta = {'url': fallbackUrl, 'headers': transcodeHeaders};
      await _initializePlayer(fallbackUrl, transcodeHeaders);
    } catch (e) {
      if (mounted) {
        setState(() { _isLoading = false; _hasError = false; _streamOverlayMessage = ''; });
        _showPlayerToast('Proxy unavailable. Resuming stream.');
        _isRetryingStream = false;
        await _initializePlayer(_currentChannel.streamUrl, {
          if (_currentChannel.userAgent != null) 'User-Agent': _currentChannel.userAgent!,
          if (_currentChannel.referrer != null) 'Referer': _currentChannel.referrer!,
        });
      }
    }
  }

  /// Finds the next lower quality variant below the current selection, or null if none.
  Map<String, dynamic>? _findLowerQuality() {
    if (_qualities.isEmpty) return null;
    int currentHeight = _selectedQuality?['height'] ?? 9999;
    if (_selectedQuality?['type'] == 'auto') currentHeight = 9999;

    Map<String, dynamic>? best;
    for (final q in _qualities) {
      if (q['type'] == 'auto') continue;
      final h = (q['height'] as num?)?.toInt() ?? 0;
      if (h > 0 && h < currentHeight) {
        if (best == null || h > ((best['height'] as num?)?.toInt() ?? 0)) {
          best = q;
        }
      }
    }
    return best;
  }

  Future<void> _handleStreamFailure(String reason) async {
    if (_isRetryingStream) return;
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _startupTimer?.cancel();
    _startupTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    // Silent retry flow (Attempt 1: Retry once silently before falling back)
    if (_retryAttempt < 2) {
      _retryAttempt++;
      if (mounted) {
        setState(() {
          _streamOverlayMessage = 'Still loading. Trying again...';
          _isLoading = true;
          _hasError = false;
        });
      }
      await Future.delayed(const Duration(milliseconds: 1500));
      // Re-initialize player with same parameters
      final headersToUse = (_selectedQuality != null && _selectedQuality!['headers'] != null)
          ? _selectedQuality!['headers']
          : _currentStreamMeta?['headers'];
      await _initializePlayer(_currentUrl, headersToUse);
      return;
    }

    _isRetryingStream = true;
    _hadFailureBeforePlaying = true; // mark that we had a failure before success
    _retryAttempt = 0; // Reset for fallback streams

    try {
      await _api.post(ApiEndpoints.channelReportFailurePath(_currentChannel.id), {
        'reason': reason,
        'stream_url': _currentUrl,
        'stream_id': _currentStreamMeta?['id'],
      });
    } catch(e) {}

    // Try lower quality first if it was a buffer stall.
    // Guard: only downgrade if there are REAL quality variants with known resolution.
    // If only the 'auto' entry exists, skip quality downgrade entirely - no fake options.
    final hasRealVariants = _qualities.any(
        (q) => q['type'] != 'auto' && ((q['height'] as num?)?.toInt() ?? 0) > 0 && q['url'] != null);

    if (reason == 'buffer_timeout' && hasRealVariants && _selectedQuality != null && _qualities.isNotEmpty) {
      int currentHeight = (_selectedQuality!['height'] as num?)?.toInt() ?? 9999;
      if (_selectedQuality!['type'] == 'auto') currentHeight = 9999;

      dynamic lowerQuality;
      for (var q in _qualities) {
        if (q['type'] == 'auto') continue;
        int h = (q['height'] as num?)?.toInt() ?? 0;
        if (h > 0 && h < currentHeight) {
          if (lowerQuality == null || h > ((lowerQuality['height'] as num?)?.toInt() ?? 0)) {
            lowerQuality = q;
          }
        }
      }

      if (lowerQuality != null) {
        final lowerLabel = lowerQuality['label'] as String? ?? 'lower quality';
        if (mounted) setState(() { _streamOverlayMessage = 'Switching to smoother quality...'; _isLoading = true; _hasError = false; });
        _selectedQuality = lowerQuality;
        _wasQualityDowngraded = true;  // remember for auto upgrade timer
        _isRetryingStream = false;
        await _initializePlayer(lowerQuality['url'], lowerQuality['headers'] ?? _currentStreamMeta?['headers'] ?? {});
        _showPlayerToast('Switched to $lowerLabel for smoother playback');
        return;
      }

      // Smart Fallback to AWS Server (Auto-Transcode) for Premium users
      if (_isPremium && !_currentUrl.contains('/api/stream/transcode/')) {
        if (mounted) setState(() { _streamOverlayMessage = 'Trying optimized stream...'; _isLoading = true; _hasError = false; });
        _isRetryingStream = false;
        try {
          final token = await StorageService().getToken() ?? '';
          if (token.isEmpty) throw Exception('No token');
          // Fix #14: Token in Authorization header, not URL query param
          final fallbackUrl = '${BackendConfig.baseUrl}${ApiEndpoints.streamTranscodePath(_currentChannel.id, quality: '360')}';
          final transcodeHeaders = {'Authorization': 'Bearer $token'};
          _currentStreamMeta = {'url': fallbackUrl, 'headers': transcodeHeaders};
          await _initializePlayer(fallbackUrl, transcodeHeaders);
          return;
        } catch (e) {
          // Transcode unavailable - continue to backup stream fallback below
          if (mounted) setState(() { _isLoading = false; _streamOverlayMessage = ''; });
        }
      }
    }

    if (_backupStreams.isNotEmpty) {
      if (mounted) setState(() { _streamOverlayMessage = 'Trying another source...'; _isLoading = true; _hasError = false; });
      final backup = _backupStreams.removeAt(0);
      _currentStreamMeta = backup;
      _isRetryingStream = false; // allow next failure cycle on the backup stream
      await _initializePlayer(backup['url'], backup['headers']);
      return;
    }

    // Proxy fallback - only for legal/public streams; proxy_url is null for DRM/geo/unlicensed.
    // This is the last resort before showing an error to the user.
    if (!_proxyAttempted && _proxyUrl != null) {
      _proxyAttempted = true;
      _isRetryingStream = false;
      if (mounted) setState(() {
        _streamOverlayMessage = 'Optimizing stream...';
        _isLoading = true;
        _hasError = false;
      });
      // Proxy URL already routes through auth - no extra headers needed from client
      await _initializePlayer(_proxyUrl!, {});
      return;
    }

    if (mounted) setState(() { _isLoading = false; _hasError = true; _streamOverlayMessage = ''; });
  }

  /// Reports successful playback to backend.
  /// If the stream played after a prior failure/retry, marks it as 'unstable' (not offline).
  Future<void> _reportPlaybackSuccess() async {
    try {
      final result = _hadFailureBeforePlaying ? 'played_after_retry' : 'played';
      // Fix #18: Compute elapsed seconds since play start and send as buffer_seconds.
      // Previously this was never sent, causing watch_history.watch_duration to always be 0.
      final int bufferSeconds = _playStartTime != null
          ? DateTime.now().difference(_playStartTime!).inSeconds
          : 0;
      await _api.post(ApiEndpoints.channelPlaybackResultPath(_currentChannel.id), {
        'result': result,
        'status': _hadFailureBeforePlaying ? 'unstable' : 'online',
        'stream_url': _currentUrl,
        'stream_id': _currentStreamMeta?['id'],
        'buffer_seconds': bufferSeconds,
      });
    } catch (_) {}
  }

  // ---- Data Loading ----

  Future<void> _loadChannelData() async {
    final channelId = _currentChannel.id;
    if (mounted) setState(() { _loadingEPG = true; _loadingRelated = true; });

    // EPG Now Playing
    try {
      final nowRes = await _api.get(ApiEndpoints.channelEPGNowPath(channelId));
      if (mounted && nowRes['success'] == true && nowRes['data'] != null) {
        _nowPlaying = EpgProgram.fromJson(nowRes['data']);
      }
    } catch (_) {
      _nowPlaying = null;
    }

    // Upcoming EPG
    try {
      final upcomingRes = await _api.get(ApiEndpoints.channelEPGUpcomingPath(channelId));
      if (mounted && upcomingRes['success'] == true && upcomingRes['data'] != null) {
        final rawUpcoming = upcomingRes['data'];
        if (rawUpcoming is List) {
          _upcoming = rawUpcoming.map((p) => EpgProgram.fromJson(p)).toList();
        }
      }
    } catch (_) {
      _upcoming = [];
    }

    if (mounted) setState(() { _loadingEPG = false; });

    // Related Channels
    try {
      final relatedRes = await _api.get(ApiEndpoints.channelRelatedPath(channelId));
      if (mounted && relatedRes['success'] == true && relatedRes['data'] != null) {
        final data = relatedRes['data'];
        _relatedSourceType = data['source_type'] as String? ?? '';
        _relatedChannels = ((data['channels'] as List?) ?? [])
            .map((c) => ChannelModel.fromJson(c))
            .toList();
      }
    } catch (_) {
      _relatedChannels = [];
      _relatedSourceType = '';
    }

    if (mounted) setState(() { _loadingRelated = false; });
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 500) {
      if (_hasMoreAfter && !_moreLoading) {
        _fetchContextChannelsPage(page: _nextPage);
      }
    }
  }

  Future<void> _fetchContextChannelsPage({required int page, bool prepend = false}) async {
    if (_sourceType != PlayerSourceType.liveTv &&
        _sourceType != PlayerSourceType.category &&
        _sourceType != PlayerSourceType.search) {
      return;
    }

    if (mounted) setState(() { _moreLoading = true; });
    try {
      final res = await _api.get(ApiEndpoints.channels, queryParameters: {
        'page': page.toString(),
        'limit': '50',
        ..._sourceFilters.toJson(),
      });
      if (!mounted) return;
      if (res['success'] == true) {
        final data = res['data'] as List? ?? [];
        final pagination = res['pagination'] as Map<String, dynamic>?;
        final newChannels = data
            .map((c) => ChannelModel.fromJson(c))
            .toList();

        setState(() {
          final existingIds = _contextChannels.map((c) => c.id).toSet();
          final filtered = newChannels.where((c) => !existingIds.contains(c.id)).toList();

          if (prepend) {
            _contextChannels.insertAll(0, filtered);
            _currentIndex += filtered.length;
            _previousPage = page;
            _hasMoreBefore = page > 1;
          } else {
            _contextChannels.addAll(filtered);
            _nextPage = page + 1;
            _hasMoreAfter = pagination?['hasMore'] == true;
          }
          _moreLoading = false;
          _updateMoreChannelsFromContext();
        });
      } else {
        if (mounted) setState(() { _moreLoading = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _moreLoading = false; });
    }
  }

  void _updateMoreChannelsFromContext() {
    if (_contextChannels.isEmpty) {
      _moreLiveChannels = [];
      return;
    }
    
    final before = _contextChannels.sublist(
      (_sourceType == PlayerSourceType.search || _sourceType == PlayerSourceType.favorites)
          ? 0
          : (_currentIndex - 6).clamp(0, _contextChannels.length),
      _currentIndex.clamp(0, _contextChannels.length),
    );
    final after = _contextChannels.sublist(
      (_currentIndex + 1).clamp(0, _contextChannels.length),
      (_sourceType == PlayerSourceType.search || _sourceType == PlayerSourceType.favorites)
          ? _contextChannels.length
          : (_currentIndex + 15).clamp(0, _contextChannels.length),
    );

    final combined = [...after, ...before];
    final Set<int> seenIds = {};
    final List<ChannelModel> distinct = [];
    
    for (final ch in combined) {
      if (ch.id != _currentChannel.id && seenIds.add(ch.id)) {
        distinct.add(ch);
      }
    }

    _moreLiveChannels = distinct;
  }

  // ---- Channel Navigation ----

  ChannelModel get _currentChannel => _contextChannels[_currentIndex];

  void _onChannelChanged({bool fetchNewContext = false}) {
    _hadFailureBeforePlaying = false;
    _retryAttempt = 0;
    // Reset smooth playback state for new channel
    _smoothPlaybackEnabled = false;
    _bufferReady = false;
    _delaySeconds = 0;
    _bufferStatus = '';
    _fallbackDirectUrl = null;
    _showPreparingOverlay = false;
    // Reset auto-detected display state for new channel
    _autoDetectedFitMode = null;
    _detectedAspectRatioType = 'unknown';
    _detectedVideoWidth = null;
    _detectedVideoHeight = null;
    // Re-resolve fit mode per channel priority chain
    _resolveFitMode().then((_) {
      if (mounted) setState(() {});
    });
    _slowOverlaySuppressedForSession = false;
    _hideSlowConnectionOverlay();
    if (mounted) setState(() { _playerToast = ''; });
    _nowPlaying = null;
    _upcoming = [];
    _relatedChannels = [];
    _relatedSourceType = '';
    
    if (_scrollController.hasClients) {
      _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
    
    _fetchPlaybackAndInitialize();
    _loadChannelData();

    if (fetchNewContext) {
      _fetchContextChannelsPage(page: 1);
    } else {
      _updateMoreChannelsFromContext();
    }
  }

  void _playChannel(ChannelModel ch) {
    int index = _contextChannels.indexWhere((c) => c.id == ch.id);
    if (index >= 0) {
      setState(() {
        _currentIndex = index;
      });
      _onChannelChanged(fetchNewContext: false);
    } else {
      setState(() {
        _sourceFilters = ChannelSourceFilters(
          categoryId: ch.categoryId,
          categoryName: ch.categoryName,
          workingOnly: _sourceFilters.workingOnly,
          sort: 'recommended',
        );
        _sourceType = PlayerSourceType.category;
        _contextChannels = [ch];
        _currentIndex = 0;
        _previousPage = 1;
        _nextPage = 1;
        _hasMoreBefore = false;
        _hasMoreAfter = true;
      });
      _onChannelChanged(fetchNewContext: true);
    }
  }

  void _playNextChannel() {
    if (_contextChannels.isEmpty) return;
    int next = _currentIndex + 1;
    if (next >= _contextChannels.length) {
      if (_hasMoreAfter && !_moreLoading) {
        _fetchContextChannelsPage(page: _nextPage).then((_) {
          if (_currentIndex + 1 < _contextChannels.length) {
            setState(() {
              _currentIndex++;
            });
            _onChannelChanged();
          }
        });
        return;
      } else {
        next = 0; // Wrap around
      }
    }
    setState(() {
      _currentIndex = next;
    });
    _onChannelChanged();
  }

  void _playPreviousChannel() {
    if (_contextChannels.isEmpty) return;
    int prev = _currentIndex - 1;
    if (prev < 0) {
      if (_hasMoreBefore && _previousPage > 1 && !_moreLoading) {
        _fetchContextChannelsPage(page: _previousPage - 1, prepend: true).then((_) {
          if (_currentIndex > 0) {
            setState(() {
              _currentIndex--;
            });
            _onChannelChanged();
          }
        });
        return;
      } else {
        prev = _contextChannels.length - 1; // Wrap around
      }
    }
    setState(() {
      _currentIndex = prev;
    });
    _onChannelChanged();
  }

  // ---- Controls Logic ----

  BoxFit _getBoxFit() {
    switch (_effectiveFitMode()) {
      case 'fill':
        return BoxFit.contain;
      case 'zoom':
        return BoxFit.cover;
      case 'stretch':
        return BoxFit.fill;
      case 'auto':
      case 'fit':
      default:
        return BoxFit.contain;
    }
  }

  double _getTransformScale(BuildContext context) {
    switch (_effectiveFitMode()) {
      case 'fill':
        return _safeFillScale(context, maxCropPerSide: _isNewsChannel ? 0.04 : 0.08);
      case 'zoom':
        return 1.10;
      default:
        return 1.0;
    }
  }

  double _safeFillScale(BuildContext context, {required double maxCropPerSide}) {
    final videoW = _detectedVideoWidth ?? 0;
    final videoH = _detectedVideoHeight ?? 0;
    if (videoW <= 0 || videoH <= 0) return 1.0 + maxCropPerSide;

    final renderBox = _videoKey.currentContext?.findRenderObject() as RenderBox?;
    final surfaceSize = renderBox?.size ?? MediaQuery.of(context).size;
    final screenW = surfaceSize.width;
    final screenH = surfaceSize.height;
    if (screenW <= 0 || screenH <= 0) return 1.0;

    final containScale = (screenW / videoW) < (screenH / videoH)
        ? (screenW / videoW)
        : (screenH / videoH);
    final containedW = videoW * containScale;
    final containedH = videoH * containScale;
    if (containedW <= 0 || containedH <= 0) return 1.0;

    final coverRelScale = (screenW / containedW) > (screenH / containedH)
        ? (screenW / containedW)
        : (screenH / containedH);
    if (coverRelScale <= 1.0) return 1.0;

    final maxSafeScale = 1.0 / (1.0 - 2.0 * maxCropPerSide);
    return coverRelScale < maxSafeScale ? coverRelScale : maxSafeScale;
  }

  String _getFitSubtitle() {
    final effective = _effectiveFitMode();
    final ratio = _detectedAspectRatioType != 'unknown' ? _detectedAspectRatioType : 'detecting';
    if (_normalizeFitMode(_fitMode) == 'auto') {
      return 'Auto -> ${_getFitLabelForMode(effective)} / $ratio';
    }
    return '$ratio / ${_getFitModeSource()}';
  }

  String _getFitLabelForMode(String mode) {
    switch (_normalizeFitMode(mode)) {
      case 'fit':     return 'Fit';
      case 'fill':    return 'Fill';
      case 'zoom':    return 'Zoom';
      case 'stretch': return 'Stretch';
      case 'auto':
      default:        return 'Auto';
    }
  }

  String _getRecommendedFitMode() {
    if (_isNewsChannel) return 'fit';
    if (_currentChannel.defaultFitMode != 'original' &&
        _currentChannel.defaultFitMode != 'unknown' &&
        _currentChannel.defaultFitMode.isNotEmpty) {
      final serverMode = _normalizeFitMode(_currentChannel.defaultFitMode);
      return serverMode == 'auto' ? 'fill' : serverMode;
    }
    if (_currentChannel.hasInternalBlackBars) return 'zoom';
    if (_detectedAspectRatioType == '4:3' || _detectedAspectRatioType == 'vertical') return 'fit';
    return 'fill';
  }

  void _onDoubleTapFitToggle() {
    const cycle = ['auto', 'fit', 'fill', 'zoom'];
    var current = _normalizeFitMode(_fitMode);
    if (!cycle.contains(current)) current = 'auto';
    final idx = cycle.indexOf(current);
    final next = cycle[(idx + 1) % cycle.length];
    setState(() { _fitMode = next; });
    _saveFitModePreference();
    _showFitToast(next);
    _showControlsWithTimer();
  }

  void _showFitToast(String mode) {
    final labels = {
      'auto': 'Auto size: ${_getFitLabelForMode(_effectiveFitMode())}',
      'fit': 'Fit: full frame',
      'fill': 'Fill: bigger picture',
      'zoom': 'Zoom: strongest crop',
      'stretch': 'Stretch: fills screen',
    };
    var label = labels[_normalizeFitMode(mode)] ?? 'Auto size';
    if (_isNewsChannel && _isCropMode(_effectiveFitMode())) {
      label += ' (may crop tickers)';
    }
    _showPlayerToast(label);
  }

  void _toggleControls() {
    if (_showControls) {
      _hideControls();
    } else {
      _showControlsWithTimer();
    }
  }

  void _showControlsWithTimer() {
    _controlsTimer?.cancel();
    setState(() { _showControls = true; });
    _controlsAnimController.forward();
    _controlsTimer = Timer(const Duration(seconds: 3), _hideControls);
  }

  void _hideControls() {
    _controlsTimer?.cancel();
    _controlsAnimController.reverse().then((_) {
      if (mounted) setState(() { _showControls = false; });
    });
  }

  void _toggleFullScreen() {
    setState(() { _isFullScreen = !_isFullScreen; });
    if (_isFullScreen) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    _showControlsWithTimer();
  }

  void _retry() {
    setState(() { _isLoading = true; _hasError = false; _isRetryingStream = false; });
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _startupTimer?.cancel();
    _startupTimer = null;
    _fetchPlaybackAndInitialize();
  }

  String _formatTimeRange(DateTime? start, DateTime? end) {
    if (start == null || end == null) return '';
    final fmt = DateFormat('h:mm a');
    return '${fmt.format(start.toLocal())} - ${fmt.format(end.toLocal())}';
  }

  String _getCategoryLabel(String? name) {
    if (name == null || name.trim().isEmpty) return 'General';
    final n = name.toLowerCase().trim();
    if (n == 'unknown' || n == 'undefined' || n == 'shopping' || n == 'shop') return 'General';
    return name;
  }

  @override
  void dispose() {
    // Fix #14: Dispose video player FIRST before animation controller to prevent
    // animation callbacks firing after widget is unmounted
    _bufferTimer?.cancel();
    _startupTimer?.cancel();
    _reconnectTimer?.cancel();
    _controlsTimer?.cancel();
    _slowOverlayTimer?.cancel();
    _playerToastTimer?.cancel();
    _qualityUpgradeTimer?.cancel();
    _playerSubscription?.cancel();
    _playerErrorSubscription?.cancel();
    _videoParamsSubscription?.cancel();
    // Fix #4: Cancel error grace timer on dispose to prevent post-dispose callbacks
    _errorGraceTimer?.cancel();
    _player.dispose();
    _controlsAnimController.dispose();
    _scrollController.dispose();
    // Fix #9: Disable wakelock when leaving player
    WakelockPlus.disable();
    if (_isFullScreen) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }

  // =====================================================================
  // BUILD
  // =====================================================================

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_isFullScreen,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_isFullScreen) {
          _toggleFullScreen();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: _isFullScreen
            ? _buildFullscreen()
            : SafeArea(child: _buildPortrait()),
      ),
    );
  }

  // ---- Fullscreen ----

  Widget _buildFullscreen() {
    return GestureDetector(
      onTap: _toggleControls,
      onDoubleTap: _onDoubleTapFitToggle,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Video fills the entire screen - no SafeArea, no constraints
          Positioned.fill(child: _buildVideoSurface()),
          if (_isLoading) Positioned.fill(child: _buildLoadingOverlay()),
          if (_hasError) Positioned.fill(child: _buildErrorOverlay()),
          // Controls overlay - safe padding on controls only, not video
          Positioned.fill(
            child: FadeTransition(
              opacity: _controlsOpacity,
              child: IgnorePointer(
                ignoring: !_showControls,
                child: _buildControlsOverlay(fullscreen: true),
              ),
            ),
          ),
          _buildSlowConnectionOverlay(),
          _buildPlayerToast(),
        ],
      ),
    );
  }

  // ---- Portrait ----

  Widget _buildPortrait() {
    return Column(
      children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Container(
            color: Colors.black,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _buildVideoSurface(),
                Positioned.fill(
                  child: GestureDetector(
                    onTap: _toggleControls,
                    onDoubleTap: _onDoubleTapFitToggle,
                    behavior: HitTestBehavior.translucent,
                    child: const SizedBox.expand(),
                  ),
                ),
                if (_isLoading) Positioned.fill(child: _buildLoadingOverlay()),
                if (_hasError) Positioned.fill(child: _buildErrorOverlay()),
                if (!_hasError && !_isLoading)
                  Positioned.fill(
                    child: FadeTransition(
                      opacity: _controlsOpacity,
                      child: IgnorePointer(
                        ignoring: !_showControls,
                        child: _buildControlsOverlay(),
                      ),
                    ),
                  ),
                _buildSlowConnectionOverlay(),
                _buildPlayerToast(),
              ],
            ),
          ),
        ),

        // ---- Scrollable info area ----
        Expanded(
          child: Container(
            color: const Color(AppColors.background),
            child: CustomScrollView(
              controller: _scrollController,
              physics: const BouncingScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildChannelInfo(),
                        const SizedBox(height: 14),
                        _buildNowPlayingCard(),
                        const SizedBox(height: 10),
                        _buildUpcomingCard(),
                        const SizedBox(height: 18),
                        _buildRelatedSection(),
                        const SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
                _buildMoreLiveHeader(),
                _buildMoreLiveGrid(),
                SliverToBoxAdapter(child: _buildMoreLiveFooter()),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ---- Video Surface ----

  Widget _buildVideoSurface() {
    return SizedBox.expand(
      child: ClipRect(
        child: Transform.scale(
          key: _videoKey,
          scale: _getTransformScale(context),
          child: Video(
            controller: _videoController,
            fit: _getBoxFit(),
            controls: NoVideoControls,
            filterQuality: FilterQuality.high,
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingOverlay() {
    if (_isLoading) {
      return Container(
        color: Colors.black87,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: Color(AppColors.primary), strokeWidth: 3),
              if (_showPreparingOverlay) ...[
                const SizedBox(height: 16),
                const Text('Preparing smooth playback...', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text('Building ${(_delaySeconds ~/ 60)}-min buffer for smoother viewing', style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ] else if (_streamOverlayMessage.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(_streamOverlayMessage, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ],
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildErrorOverlay() {
    return Container(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.signal_cellular_off_rounded, size: 56, color: Colors.white38),
              const SizedBox(height: 16),
              const Text(
                'Stream unavailable',
                style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'No stable source is available right now.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _actionButton(Icons.refresh_rounded, 'Retry', _retry),
                  if (_contextChannels.length > 1) ...[
                    const SizedBox(width: 12),
                    _actionButton(Icons.skip_next_rounded, 'Next', _playNextChannel, outlined: true),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---- Slow Connection Overlay ----

  Widget _buildSlowConnectionOverlay() {
    final safe = MediaQuery.of(context).padding;
    return IgnorePointer(
      ignoring: !_showSlowConnectionOverlay,
      child: AnimatedOpacity(
        opacity: _showSlowConnectionOverlay ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 300),
        child: AnimatedSlide(
          offset: _showSlowConnectionOverlay ? Offset.zero : const Offset(0, 0.15),
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              margin: EdgeInsets.fromLTRB(16, 0, 16, 68 + safe.bottom),
              constraints: const BoxConstraints(maxWidth: 520),
              decoration: BoxDecoration(
                color: const Color(0xEA0A0A0A),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white.withOpacity(0.12)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.6), blurRadius: 20, offset: const Offset(0, 4)),
                ],
              ),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.signal_cellular_alt_1_bar_rounded, color: Colors.orangeAccent, size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Network is unstable',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Switch to lower quality for smoother playback.',
                          style: TextStyle(color: Colors.white60, fontSize: 11),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            GestureDetector(
                              onTap: () {
                                _slowOverlaySuppressedForSession = true;
                                _hideSlowConnectionOverlay();
                              },
                              child: const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                child: Text(
                                  'Not now',
                                  style: TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            GestureDetector(
                              onTap: () async {
                                _hideSlowConnectionOverlay();
                                final lowerQuality = _findLowerQuality();
                                if (lowerQuality != null) {
                                  final label = lowerQuality['label'] as String? ?? 'lower quality';
                                  setState(() {
                                    _selectedQuality = lowerQuality;
                                    _streamOverlayMessage = 'Switching to $label...';
                                    _isLoading = true;
                                    _hasError = false;
                                  });
                                  _isRetryingStream = false;
                                  await _initializePlayer(
                                    lowerQuality['url'],
                                    lowerQuality['headers'] ?? _currentStreamMeta?['headers'] ?? {},
                                  );
                                  _showPlayerToast('Switched to $label for smoother playback');
                                } else if (_isPremium && !_currentUrl.contains('/api/stream/transcode/')) {
                                  _switchToTranscode();
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(AppColors.primary),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Switch',
                                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPlayerToast() {
    return IgnorePointer(
      child: AnimatedOpacity(
        opacity: _playerToast.isNotEmpty ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 250),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            margin: const EdgeInsets.only(bottom: 20),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xCC000000),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(_playerToast, style: const TextStyle(color: Colors.white, fontSize: 12)),
          ),
        ),
      ),
    );
  }

  Widget _actionButton(IconData icon, String label, VoidCallback onTap, {bool outlined = false}) {
    return outlined
        ? OutlinedButton.icon(
            onPressed: onTap,
            icon: Icon(icon, size: 16),
            label: Text(label),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white70,
              side: const BorderSide(color: Colors.white30),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          )
        : ElevatedButton.icon(
            onPressed: onTap,
            icon: Icon(icon, size: 16),
            label: Text(label),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(AppColors.primary),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
  }

  // ---- Pro Player Controls Overlay ----

  Widget _buildControlsOverlay({bool fullscreen = false}) {
    final safe = MediaQuery.of(context).padding;
    return GestureDetector(
      onTap: _toggleControls,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.25, 0.70, 1.0],
            colors: [
              Color(0xDD000000),
              Color(0x55000000),
              Color(0x33000000),
              Color(0xDD000000),
            ],
          ),
        ),
        child: Column(
          children: [
            _buildControlsTopBar(fullscreen: fullscreen, safeTop: fullscreen ? safe.top : 0),
            const Spacer(),
            _buildCenterControls(),
            const Spacer(),
            _buildControlsBottomBar(fullscreen: fullscreen, safeBottom: fullscreen ? safe.bottom : 0),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsTopBar({bool fullscreen = false, double safeTop = 0}) {
    final logoSize = fullscreen ? 48.0 : 36.0;
    return Padding(
      padding: EdgeInsets.fromLTRB(4, 4 + safeTop, 8, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
            onPressed: _isFullScreen ? _toggleFullScreen : () => Navigator.of(context).pop(),
          ),
          // Channel logo + title with dark backdrop for visibility
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0x99000000), Color(0x44000000)],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: logoSize,
                  height: logoSize,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: ChannelLogo(
                      key: ValueKey(_currentChannel.id),
                      logoUrl: _currentChannel.logoUrl,
                      localLogoUrl: _currentChannel.localLogoUrl,
                      channelName: _currentChannel.name,
                      cacheKey: 'player_${_currentChannel.id}',
                      size: logoSize,
                      borderRadius: 8,
                    ),
                  ),
                ),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _currentChannel.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (_currentChannel.categoryName != null)
                        Text(
                          _currentChannel.categoryName!,
                          style: const TextStyle(color: Colors.white70, fontSize: 11),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          // LIVE / Smooth Live indicator
          if (_smoothPlaybackEnabled && _bufferReady)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 6),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1565C0),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('SMOOTH LIVE', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                  Text(
                    '${(_delaySeconds ~/ 60)} min delay',
                    style: const TextStyle(color: Colors.white70, fontSize: 7),
                  ),
                ],
              ),
            )
          else
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 6),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 4),
                  const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                ],
              ),
            ),
          // Go Live button (only when delayed playback is active and direct fallback exists)
          if (_smoothPlaybackEnabled && _bufferReady && _fallbackDirectUrl != null && _fallbackDirectUrl!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: TextButton(
                onPressed: () async {
                  try {
                    await _player.stop();
                    await _initializePlayer(_fallbackDirectUrl!, {});
                    if (mounted) {
                      setState(() {
                        _smoothPlaybackEnabled = false;
                        _bufferReady = false;
                        _showPreparingOverlay = false;
                      });
                    }
                    _showPlayerToast('Switched to Live');
                  } catch (e) {
                    _showPlayerToast('Failed to go live');
                  }
                },
                style: TextButton.styleFrom(
                  backgroundColor: Colors.red.withOpacity(0.9),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  minimumSize: const Size(0, 28),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 4),
                    const Text('GO LIVE', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                  ],
                ),
              ),
            ),
          IconButton(
            icon: Icon(
              _isFullScreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
              color: Colors.white,
              size: 26,
            ),
            onPressed: _toggleFullScreen,
          ),
        ],
      ),
    );
  }

  Widget _buildCenterControls() {
    return StreamBuilder<bool>(
      stream: _player.stream.playing,
      builder: (context, snapshot) {
        final isPlaying = snapshot.data ?? false;
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Previous
            _controlIconButton(
              icon: Icons.skip_previous_rounded,
              size: 34,
              onTap: _playPreviousChannel,
            ),
            const SizedBox(width: 28),
            // Play / Pause - large circle button
            GestureDetector(
              onTap: () {
                _player.playOrPause();
                _showControlsWithTimer();
              },
              child: Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                ),
                child: Icon(
                  isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 38,
                ),
              ),
            ),
            const SizedBox(width: 28),
            // Next
            _controlIconButton(
              icon: Icons.skip_next_rounded,
              size: 34,
              onTap: _playNextChannel,
            ),
          ],
        );
      },
    );
  }

  Widget _controlIconButton({required IconData icon, required double size, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: () {
        onTap();
        _showControlsWithTimer();
      },
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: size),
      ),
    );
  }

  Widget _buildControlsBottomBar({bool fullscreen = false, double safeBottom = 0}) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 12 + safeBottom),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          // Quality selector
          Builder(builder: (context) {
            String buttonLabel = 'Auto';
            if (_player.state.track.video.id != 'auto' && _player.state.track.video.h != null) {
              buttonLabel = '${_player.state.track.video.h}p';
            } else if (_selectedQuality != null) {
              buttonLabel = _selectedQuality!['label'];
            } else if (_player.state.height != null && _player.state.height! > 0) {
              buttonLabel = '${_player.state.height}p Auto';
            }

            return GestureDetector(
              onTap: _showQualitySelector,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.settings_suggest, size: 14, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(
                      buttonLabel,
                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(width: 10),
          // Video size / fit mode selector
          GestureDetector(
            onTap: _showFitSelector,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.white24),
              ),
              child: Row(
                children: [
                  const Icon(Icons.aspect_ratio_rounded, size: 14, color: Colors.white),
                  const SizedBox(width: 4),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 132),
                    child: Text(
                      _getFitSubtitle(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_contextChannels.length > 1) ...[
            const SizedBox(width: 10),
            Text(
              '${_currentIndex + 1} / ${_contextChannels.length}',
              style: const TextStyle(color: Colors.white60, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }

  void _showQualitySelector() {
    _controlsTimer?.cancel();
    
    final nativeTracks = _player.state.tracks.video;
    // Exclude the 'no' track which disables video
    final availableNativeTracks = nativeTracks.where((t) => t.id != 'no').toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          decoration: BoxDecoration(
            color: const Color(AppColors.surface).withOpacity(0.98),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: Colors.white.withOpacity(0.1), width: 1)),
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 24),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Video Quality', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (availableNativeTracks.length > 1) 
                    ...availableNativeTracks.map((track) {
                      final isSelected = _player.state.track.video == track;
                      String label = 'Auto';
                      String subLabel = 'Optimal quality for your connection';
                      if (track.id != 'auto' && track.h != null) {
                        label = '${track.h}p';
                        if (track.h! >= 720) subLabel = 'High Definition';
                        else subLabel = 'Standard Definition';
                      } else if (track.id != 'auto') {
                        label = track.title ?? track.id;
                        subLabel = 'Fixed quality';
                      }
                      
                      return _buildQualityTile(label, subLabel, isSelected, false, () {
                        Navigator.pop(context);
                        _player.setVideoTrack(track);
                        setState((){});
                      });
                    })
                  else if (_qualities.isNotEmpty)
                    ..._qualities.map((q) {
                      final isSelected = _selectedQuality != null && _selectedQuality!['url'] == q['url'];
                      String label = q['label'] ?? 'Unknown';
                      String subLabel = label.toLowerCase().contains('auto') ? 'Optimal quality' : 'Fixed quality';
                      return _buildQualityTile(label, subLabel, isSelected, false, () {
                        Navigator.pop(context);
                        _changeQuality(q);
                      });
                    })
                  else
                    _buildQualityTile('Original Quality', 'Broadcaster default', _selectedQuality == null, false, () {
                      Navigator.pop(context);
                      // Do nothing, already on original
                    }),
                  
                  // Data Saver Options (Premium Only)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(24, 16, 24, 8),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('Data Saver', style: TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  Builder(builder: (ctx) {
                    final licenseState = context.read<LicenseCubit>().state;
                    final isPremium = licenseState is LicenseActive && licenseState.license.isPremium;
                    
                    return Column(
                      children: [
                        _buildQualityTile('480p Data Saver', 'Reduced data usage', _selectedQuality?['label'] == '480p Data Saver', !isPremium, () async {
                          if (!isPremium) {
                            _showPremiumPaywall();
                          } else {
                            Navigator.pop(context);
                            // Fix #14: Token in Authorization header, not URL query param
                            final token = await StorageService().getToken() ?? '';
                            _changeQuality({
                              'label': '480p Data Saver',
                              'url': '${BackendConfig.baseUrl}${ApiEndpoints.streamTranscodePath(_currentChannel.id, quality: '480')}',
                              'headers': {'Authorization': 'Bearer $token'},
                            });
                          }
                        }),
                        _buildQualityTile('360p Data Saver', 'Maximum data savings', _selectedQuality?['label'] == '360p Data Saver', !isPremium, () async {
                          if (!isPremium) {
                            _showPremiumPaywall();
                          } else {
                            Navigator.pop(context);
                            // Fix #14: Token in Authorization header, not URL query param
                            final token = await StorageService().getToken() ?? '';
                            _changeQuality({
                              'label': '360p Data Saver',
                              'url': '${BackendConfig.baseUrl}${ApiEndpoints.streamTranscodePath(_currentChannel.id, quality: '360')}',
                              'headers': {'Authorization': 'Bearer $token'},
                            });
                          }
                        }),
                      ],
                    );
                  }),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        );
      },
    ).then((_) => _showControlsWithTimer());
  }

  // ---- Fit Mode Selector ----

  void _showFitSelector() {
    _controlsTimer?.cancel();

    final options = [
      ('auto', 'Auto', 'Best size for this channel', Icons.auto_awesome_rounded),
      ('fit', 'Fit', 'Show the full broadcast frame', Icons.fit_screen_rounded),
      ('fill', 'Fill', 'Bigger picture with safe crop', Icons.crop_free_rounded),
      ('zoom', 'Zoom', 'Remove black bars with stronger crop', Icons.zoom_out_map_rounded),
      ('stretch', 'Stretch', 'Fill the screen, may distort', Icons.open_in_full_rounded),
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        final screen = MediaQuery.of(ctx).size;
        final maxHeight = screen.height * (screen.height < 520 ? 0.92 : 0.72);
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            final selectedMode = _normalizeFitMode(_fitMode);
            final effectiveMode = _effectiveFitMode();
            final cropWarning = _isCropMode(effectiveMode);

            void selectMode(String mode) {
              setState(() { _fitMode = _normalizeFitMode(mode); });
              setModalState(() {});
              _saveFitModePreference();
              _showFitToast(mode);
            }

            return Align(
              alignment: Alignment.bottomCenter,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxHeight, maxWidth: 560),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(AppColors.surface).withOpacity(0.98),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    border: Border(top: BorderSide(color: Colors.white.withOpacity(0.12), width: 1)),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.45), blurRadius: 24, offset: const Offset(0, -8)),
                    ],
                  ),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(height: 10),
                        Container(
                          width: 42,
                          height: 4,
                          decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(4)),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 14, 16, 10),
                          child: Row(
                            children: [
                              const Expanded(
                                child: Text('Video Size', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                              ),
                              IconButton(
                                tooltip: 'Close',
                                onPressed: () => Navigator.pop(ctx),
                                icon: const Icon(Icons.close_rounded, color: Colors.white70),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                          child: Row(
                            children: [
                              _buildFitInfoChip(Icons.aspect_ratio_rounded, _detectedAspectRatioType == 'unknown' ? 'Detecting ratio' : _detectedAspectRatioType),
                              const SizedBox(width: 8),
                              _buildFitInfoChip(Icons.tune_rounded, selectedMode == 'auto' ? 'Auto uses ${_getFitLabelForMode(effectiveMode)}' : _getFitModeSource()),
                            ],
                          ),
                        ),
                        Flexible(
                          child: ListView.separated(
                            shrinkWrap: true,
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                            itemCount: options.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 6),
                            itemBuilder: (_, index) {
                              final opt = options[index];
                              return _buildFitTile(
                                mode: opt.$1,
                                label: opt.$2,
                                sub: opt.$3,
                                icon: opt.$4,
                                isSelected: selectedMode == opt.$1,
                                isRecommended: opt.$1 == 'auto' || opt.$1 == _getRecommendedFitMode(),
                                onTap: () => selectMode(opt.$1),
                              );
                            },
                          ),
                        ),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 180),
                          child: cropWarning
                              ? Container(
                                  key: ValueKey(effectiveMode),
                                  margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withOpacity(0.10),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.amber.withOpacity(0.35)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.info_outline_rounded, color: Colors.amber, size: 18),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          _isNewsChannel
                                              ? 'This can crop tickers, logos, or subtitles. Use Fit for news channels.'
                                              : 'Fill and Zoom may crop edges. Use Fit when you need the full frame.',
                                          style: const TextStyle(color: Colors.amber, fontSize: 12, height: 1.25),
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),
                        Container(
                          padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: Colors.white.withOpacity(0.08))),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Remember for this channel', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 2),
                                    Text(
                                      _rememberFitModeForChannel ? _currentChannel.name : 'Use as global default',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                              Switch(
                                value: _rememberFitModeForChannel,
                                activeColor: const Color(AppColors.primary),
                                onChanged: (val) async {
                                  setModalState(() { _rememberFitModeForChannel = val; });
                                  if (val) {
                                    await StorageService().setChannelFitMode(_currentChannel.id, _normalizeFitMode(_fitMode));
                                  } else {
                                    await StorageService().removeChannelFitMode(_currentChannel.id);
                                    await StorageService().setVideoFitMode(_normalizeFitMode(_fitMode));
                                  }
                                },
                              ),
                              const SizedBox(width: 12),
                              ElevatedButton(
                                onPressed: () => Navigator.pop(ctx),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(AppColors.primary),
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(72, 42),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: const Text('Done'),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    ).then((_) => _showControlsWithTimer());
  }

  Widget _buildFitInfoChip(IconData icon, String label) {
    return Flexible(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withOpacity(0.10)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: Colors.white60),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFitTile({
    required String mode,
    required String label,
    required String sub,
    required IconData icon,
    required bool isSelected,
    required bool isRecommended,
    required VoidCallback onTap,
  }) {
    final selectedColor = const Color(AppColors.primary);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: isSelected ? selectedColor.withOpacity(0.16) : Colors.white.withOpacity(0.045),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? selectedColor.withOpacity(0.75) : Colors.white.withOpacity(0.08), width: 1),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isSelected ? selectedColor.withOpacity(0.22) : Colors.white.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: isSelected ? Colors.white : Colors.white70, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (isRecommended) ...[
                          const SizedBox(width: 7),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: selectedColor.withOpacity(0.22), borderRadius: BorderRadius.circular(999)),
                            child: const Text('Best', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white60, fontSize: 12, height: 1.2),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                color: isSelected ? selectedColor : Colors.white30,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showPremiumPaywall() {
    Navigator.pop(context); // Close bottom sheet
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(AppColors.surface),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.workspace_premium, color: Colors.amber),
            SizedBox(width: 8),
            Text('Premium Feature', style: TextStyle(color: Colors.white, fontSize: 20)),
          ],
        ),
        content: const Text(
          'Data Saver resolutions (480p and 360p) require real-time server processing and are only available to Premium users.\n\nUpgrade your plan to unlock this feature and save massive amounts of mobile data!',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(AppColors.primary)),
            onPressed: () {
              Navigator.pop(context);
              // Handle navigation to upgrade/plans screen
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please contact support to upgrade your plan.')));
            },
            child: const Text('Upgrade', style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );
  }

  Widget _buildQualityTile(String label, String subLabel, bool isSelected, bool isLocked, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(AppColors.primary).withOpacity(0.1) : Colors.transparent,
          border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05), width: 1)),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: isSelected ? const Color(AppColors.primary) : Colors.white38, width: 2),
              ),
              child: isSelected 
                  ? Center(child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(AppColors.primary), shape: BoxShape.circle)))
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: isSelected ? const Color(AppColors.primary) : (isLocked ? Colors.white54 : Colors.white), fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(subLabel, style: TextStyle(color: isSelected ? const Color(AppColors.primary).withOpacity(0.8) : Colors.white54, fontSize: 12)),
                ],
              ),
            ),
            if (isLocked)
              const Icon(Icons.lock, color: Colors.amber, size: 16)
            else if (label.contains('1080') || label.contains('720') || label.contains('HD'))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: const Color(AppColors.primary).withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                child: const Text('HD', style: TextStyle(color: Color(AppColors.primary), fontSize: 10, fontWeight: FontWeight.bold)),
              )
          ],
        ),
      ),
    );
  }

  Future<void> _changeQuality(Map<String, dynamic> quality) async {
    if (_selectedQuality != null && _selectedQuality!['url'] == quality['url']) return;
    
    final position = _player.state.position;
    // PLAYBACK-03 FIX: capture the label before setState so we can show it in the snackbar
    final qualityLabel = quality['label'] as String? ?? 'Unknown';

    setState(() {
      _selectedQuality = quality;
      _streamOverlayMessage = 'Changing quality...';
    });

    final headers = quality['headers'] ?? _currentStreamMeta?['headers'] ?? {};
    await _initializePlayer(quality['url'], headers, position);

    _showPlayerToast('Playing at $qualityLabel');
  }

  // ---- Channel Info ----

  Widget _buildChannelInfo() {
    final categoryLabel = _getCategoryLabel(_currentChannel.categoryName);
    final lang = _currentChannel.language;
    final quality = _currentChannel.quality;
    final showLang = lang != null && lang.trim().isNotEmpty && lang.toLowerCase() != 'unknown';
    final showQuality = quality != null && quality.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ChannelLogo(
              key: ValueKey('info_${_currentChannel.id}'),
              logoUrl: _currentChannel.logoUrl,
              localLogoUrl: _currentChannel.localLogoUrl,
              channelName: _currentChannel.name,
              cacheKey: 'info_${_currentChannel.id}',
              size: 62,
              borderRadius: 14,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _currentChannel.name,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 7,
                    runSpacing: 5,
                    children: [
                      _liveBadge(),
                      _infoChip(categoryLabel, Icons.category_outlined),
                      if (showLang) _infoChip(lang, Icons.language_outlined),
                      if (showQuality) _infoChip(quality, Icons.hd_outlined),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Action buttons row
        Row(
          children: [
            BlocBuilder<FavoriteCubit, FavoriteState>(
              builder: (context, state) {
                final isFav = state is FavoriteLoaded && state.favorites.any((c) => c.id == _currentChannel.id);
                return _actionChip(
                  icon: isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  label: isFav ? 'Saved' : 'Save',
                  color: isFav ? Colors.red : Colors.white54,
                  onTap: () => context.read<FavoriteCubit>().toggleFavorite(_currentChannel.id, isFavorite: isFav),
                );
              },
            ),
            const SizedBox(width: 10),
            _actionChip(
              icon: Icons.share_rounded,
              label: 'Share',
              color: Colors.white54,
              onTap: _shareChannel,
            ),
            const SizedBox(width: 10),
            _actionChip(
              icon: Icons.flag_outlined,
              label: 'Report',
              color: Colors.white54,
              onTap: _reportChannel,
            ),
          ],
        ),
      ],
    );
  }

  Widget _actionChip({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 5),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  void _shareChannel() {
    final name = _currentChannel.name;
    final text = 'Watch $name on NivaTV — the best live TV experience!';
    Share.share(text, subject: name);
  }

  void _reportChannel() {
    _showPlayerToast('Report submitted. Thank you.');
    try {
      _api.post(ApiEndpoints.channelReportFailurePath(_currentChannel.id), {
        'reason': 'user_report',
        'stream_url': _currentUrl,
      });
    } catch (_) {}
  }

  Widget _liveBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.red,
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Text('LIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.8)),
    );
  }

  Widget _infoChip(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(AppColors.surface),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: Colors.white38),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
        ],
      ),
    );
  }

  // ---- Now Playing Card ----

  Widget _buildNowPlayingCard() {
    if (_loadingEPG) return _buildCardShimmer(height: 120);

    final hasEPG = _nowPlaying != null && _nowPlaying!.startTime != null;
    final title = hasEPG ? _nowPlaying!.title : 'Live: ${_currentChannel.name}';
    final timeStr = hasEPG
        ? _formatTimeRange(_nowPlaying!.startTime, _nowPlaying!.endTime)
        : '${_getCategoryLabel(_currentChannel.categoryName)} - Live Broadcast';
    final desc = hasEPG ? _nowPlaying!.description : _fallbackDesc();
    final progress = hasEPG ? _nowPlaying!.progress : 0.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: _cardDecor(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('NOW PLAYING',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(AppColors.primary), letterSpacing: 1)),
              if (!hasEPG)
                Row(children: [
                  Container(width: 6, height: 6, decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  const Text('LIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.red)),
                ]),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
          if (timeStr.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(timeStr, style: const TextStyle(fontSize: 12, color: Colors.white60)),
          ],
          const SizedBox(height: 7),
          Text(desc, style: const TextStyle(fontSize: 12, color: Colors.white54, height: 1.4)),
          if (progress > 0) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.white12,
                valueColor: const AlwaysStoppedAnimation<Color>(Color(AppColors.primary)),
                minHeight: 4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _fallbackDesc() {
    final cat = _currentChannel.categoryName?.toLowerCase().trim() ?? '';
    if (cat.contains('hindi news')) return 'Watch live Hindi news, breaking updates, politics, business and current affairs.';
    if (cat.contains('english news')) return 'Watch live English news, national updates, global headlines and business coverage.';
    if (cat.contains('movie')) return 'Watch live Hindi movies and entertainment.';
    if (cat.contains('bengali')) return 'Watch live Bengali TV, news, music and entertainment.';
    if (cat.contains('sport')) return 'Watch live sports coverage and updates.';
    if (cat.contains('music')) return 'Watch live music, songs and entertainment.';
    if (cat.contains('doordarshan')) return 'Watch live Doordarshan broadcast.';
    if (cat.contains('entertainment')) return 'Watch live entertainment shows, serials and daily soaps.';
    if (cat.contains('kids')) return 'Watch live kids entertainment and cartoon shows.';
    if (cat.contains('devotional')) return 'Watch live devotional and spiritual programs.';
    return 'Watch live stream, general entertainment, and special programming.';
  }

  // ---- Upcoming Card ----

  Widget _buildUpcomingCard() {
    if (_loadingEPG) return const SizedBox.shrink();

    if (_upcoming.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: _cardDecor(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('UP NEXT',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white38, letterSpacing: 1)),
            const SizedBox(height: 10),
            const Text('Schedule not available',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white60)),
            const SizedBox(height: 4),
            const Text('Program guide will appear here when schedule data is added.',
                style: TextStyle(fontSize: 11, color: Colors.white30)),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: _cardDecor(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('UP NEXT',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white38, letterSpacing: 1)),
          const SizedBox(height: 10),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _upcoming.length,
            separatorBuilder: (_, __) => Divider(color: Colors.white.withOpacity(0.05), height: 16),
            itemBuilder: (context, i) {
              final prog = _upcoming[i];
              final time = prog.startTime != null ? DateFormat('h:mm a').format(prog.startTime!.toLocal()) : '';
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 75,
                    child: Text(time,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(AppColors.primary))),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(prog.title,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                        if (prog.description.isNotEmpty &&
                            prog.description != 'Schedule information is not available.') ...[
                          const SizedBox(height: 2),
                          Text(prog.description,
                              style: const TextStyle(fontSize: 10, color: Colors.white38),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  // ---- Related Channels ----

  String get _relatedTitle {
    if (_relatedSourceType == 'same_category') {
      final cat = _currentChannel.categoryName;
      if (cat != null && cat.isNotEmpty) return 'MORE ${cat.toUpperCase()}';
      return 'RELATED CHANNELS';
    }
    if (_relatedSourceType == 'same_language') {
      final lang = _currentChannel.language;
      if (lang != null && lang.isNotEmpty) return 'MORE IN ${lang.toUpperCase()}';
    }
    return 'RELATED CHANNELS';
  }

  Widget _buildRelatedSection() {
    if (_loadingRelated) return _buildRelatedShimmer();

    // Only show related section if the API returned real data - don't fall back to channelList
    // (the paginated "More Live Channels" grid below already covers that)
    if (_relatedChannels.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(_relatedTitle),
        const SizedBox(height: 12),
        SizedBox(
          height: 138,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: _relatedChannels.length,
            itemBuilder: (context, i) => _buildRelatedCard(_relatedChannels[i]),
          ),
        ),
      ],
    );
  }

  Widget _buildRelatedCard(ChannelModel ch) {
    final sub = [ch.categoryName, ch.language]
        .whereType<String>()
        .where((e) => e.trim().isNotEmpty && e.toLowerCase() != 'unknown')
        .join(' - ');

    return GestureDetector(
      onTap: () => _playChannel(ch),
      child: Container(
        width: 108,
        margin: const EdgeInsets.only(right: 10),
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withOpacity(0.06)),
        ),
        child: Stack(
          children: [
            Positioned(
              top: 5,
              right: 5,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(3)),
                child: const Text('LIVE', style: TextStyle(fontSize: 7, fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ChannelLogo(logoUrl: ch.logoUrl, localLogoUrl: ch.localLogoUrl, channelName: ch.name, size: 44, borderRadius: 8),
                  const SizedBox(height: 7),
                  Text(ch.name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  if (sub.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 9, color: Colors.white38)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---- More Live Channels (paginated) ----

  String get _moreSectionTitle {
    switch (_sourceType) {
      case PlayerSourceType.favorites:
        return 'MORE FAVORITES';
      case PlayerSourceType.search:
        if (_sourceFilters.searchQuery != null && _sourceFilters.searchQuery!.isNotEmpty) {
          return 'MORE RESULTS FOR "${_sourceFilters.searchQuery!.toUpperCase()}"';
        }
        return 'MORE FROM SEARCH';
      case PlayerSourceType.category:
        if (_sourceFilters.categoryName != null && _sourceFilters.categoryName!.isNotEmpty) {
          return 'MORE ${_sourceFilters.categoryName!.toUpperCase()}';
        }
        return 'MORE FROM CATEGORY';
      case PlayerSourceType.homeFeatured:
      case PlayerSourceType.homePopular:
        if (_sourceFilters.categoryName != null && _sourceFilters.categoryName!.isNotEmpty) {
          return 'MORE ${_sourceFilters.categoryName!.toUpperCase()}';
        }
        return 'MORE LIVE CHANNELS';
      case PlayerSourceType.liveTv:
      default:
        if (_sourceFilters.categoryId != null && _sourceFilters.categoryId != 0) {
          if (_sourceFilters.categoryName != null && _sourceFilters.categoryName!.isNotEmpty) {
            return 'MORE ${_sourceFilters.categoryName!.toUpperCase()}';
          }
          return 'MORE FROM CATEGORY';
        }
        return 'MORE LIVE CHANNELS';
    }
  }

  Widget _buildMoreLiveHeader() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        child: _sectionHeader(_moreSectionTitle),
      ),
    );
  }

  Widget _buildMoreLiveGrid() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      sliver: SliverLayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.crossAxisExtent;
          int crossAxisCount = 2;
          double childAspectRatio = 1.45;

          if (width > 800) {
            crossAxisCount = 4;
            childAspectRatio = 1.55;
          } else if (width > 600) {
            crossAxisCount = 3;
            childAspectRatio = 1.5;
          } else if (width < 360) {
            crossAxisCount = 2;
            childAspectRatio = 1.35;
          }

          if (_moreLiveChannels.isEmpty && _moreLoading) {
            return SliverGrid(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                childAspectRatio: childAspectRatio,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
              ),
              delegate: SliverChildBuilderDelegate(
                (_, __) => _buildGridShimmer(),
                childCount: crossAxisCount * 3,
              ),
            );
          }

          return SliverGrid(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              childAspectRatio: childAspectRatio,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) => _buildMoreLiveCard(_moreLiveChannels[index]),
              childCount: _moreLiveChannels.length,
            ),
          );
        },
      ),
    );
  }

  Widget _buildMoreLiveFooter() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: _moreLoading && _moreLiveChannels.isNotEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(AppColors.primary), strokeWidth: 2))
          : !_hasMoreAfter && _moreLiveChannels.isNotEmpty
              ? const Center(child: Text("You've reached the end", style: TextStyle(color: Colors.white24, fontSize: 12)))
              : const SizedBox.shrink(),
    );
  }

  Widget _buildMoreLiveCard(ChannelModel ch) {
    final sub = [ch.categoryName, ch.language]
        .whereType<String>()
        .where((e) => e.trim().isNotEmpty && e.toLowerCase() != 'unknown')
        .join(' - ');

    return GestureDetector(
      onTap: () => _playChannel(ch),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.06)),
        ),
        child: Stack(
          children: [
            Positioned(
              top: 6,
              right: 6,
              child: Row(
                children: [
                  if (ch.isPremium) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFD700),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: const Text('PREMIUM', style: TextStyle(fontSize: 6, fontWeight: FontWeight.w900, color: Colors.black)),
                    ),
                    const SizedBox(width: 4),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(3)),
                    child: const Text('LIVE', style: TextStyle(fontSize: 7, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  ChannelLogo(logoUrl: ch.logoUrl, localLogoUrl: ch.localLogoUrl, channelName: ch.name, size: 40, borderRadius: 8),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(ch.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                        if (sub.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 9, color: Colors.white38)),
                        ],
                        const SizedBox(height: 3),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.white10,
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Text(
                            ch.qualityLabel,
                            style: const TextStyle(fontSize: 8, color: Colors.white70, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---- Helpers & Shimmers ----

  Widget _sectionHeader(String title) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 14,
          decoration: BoxDecoration(color: const Color(AppColors.primary), borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white70, letterSpacing: 0.8)),
      ],
    );
  }

  BoxDecoration _cardDecor() {
    return BoxDecoration(
      color: const Color(AppColors.surface),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withOpacity(0.05)),
    );
  }

  Widget _buildCardShimmer({double height = 120}) {
    return Container(
      height: height,
      decoration: BoxDecoration(color: const Color(AppColors.surface), borderRadius: BorderRadius.circular(16)),
      child: Shimmer.fromColors(
        baseColor: const Color(AppColors.shimmerBase),
        highlightColor: const Color(AppColors.shimmerHighlight),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 80, height: 10, color: Colors.white),
            const SizedBox(height: 12),
            Container(width: 200, height: 14, color: Colors.white),
            const SizedBox(height: 8),
            Container(width: double.infinity, height: 10, color: Colors.white),
          ]),
        ),
      ),
    );
  }

  Widget _buildRelatedShimmer() {
    return SizedBox(
      height: 138,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: 5,
        itemBuilder: (_, __) => Container(
          width: 108,
          margin: const EdgeInsets.only(right: 10),
          decoration: BoxDecoration(color: const Color(AppColors.surface), borderRadius: BorderRadius.circular(14)),
          child: Shimmer.fromColors(
            baseColor: const Color(AppColors.shimmerBase),
            highlightColor: const Color(AppColors.shimmerHighlight),
            child: const Padding(
              padding: EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(radius: 22, backgroundColor: Colors.white),
                  SizedBox(height: 10),
                  SizedBox(width: 60, height: 9, child: ColoredBox(color: Colors.white)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGridShimmer() {
    return Container(
      decoration: BoxDecoration(color: const Color(AppColors.surface), borderRadius: BorderRadius.circular(12)),
      child: Shimmer.fromColors(
        baseColor: const Color(AppColors.shimmerBase),
        highlightColor: const Color(AppColors.shimmerHighlight),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              Container(width: 38, height: 38, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8))),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                  Container(width: double.infinity, height: 9, color: Colors.white),
                  const SizedBox(height: 6),
                  Container(width: 60, height: 7, color: Colors.white),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
