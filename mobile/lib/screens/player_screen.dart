import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_displaymode/flutter_displaymode.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:shimmer/shimmer.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
import '../models/channel_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/channel_logo.dart';
import '../widgets/premium_channel_card.dart';
import '../cubits/license_cubit.dart';
import '../cubits/mini_player_cubit.dart';
import '../utils/backend_config.dart';
import '../services/local_hls_proxy.dart';

// Temporary diagnostic logging for the "all channels reconnecting" investigation
// (work.md). Redacts token/auth values. Safe to remove once root cause is confirmed.
//
// _globalDiagLog keeps the most recent diagnostic lines in memory so the on-screen
// error overlay (Option C: no-PC-needed debugging) can show them directly on the
// phone without adb/flutter logs.
final List<String> _globalDiagLog = [];

void _playerDebugLog(String tag, Map<String, dynamic> fields) {
  dynamic redactValue(dynamic value, String? key) {
    if (key != null && (key.toLowerCase().contains('token') || key.toLowerCase().contains('authorization'))) {
      return value == null ? null : '[REDACTED]';
    }
    if (value is Map) {
      return value.map((k, v) => MapEntry(k, redactValue(v, k.toString())));
    }
    if (value is List) {
      return value.map((v) => redactValue(v, null)).toList();
    }
    if (value is String) {
      return value.replaceAll(RegExp(r'token=[^&\s]+'), 'token=[REDACTED]')
                  .replaceAll(RegExp(r'Bearer\s+[A-Za-z0-9\-\._~+/]+=*'), 'Bearer [REDACTED]');
    }
    return value;
  }
  final redacted = fields.map((k, v) => MapEntry(k, redactValue(v, k)));
  final line = '[PlayerDiag][$tag] $redacted';
  if (kDebugMode) debugPrint(line);
  _globalDiagLog.add(line);
  if (_globalDiagLog.length > 80) {
    _globalDiagLog.removeRange(0, _globalDiagLog.length - 80);
  }
}

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
  final bool isMinimized;
  final bool isOsPipMode;

  const PlayerScreen({
    super.key,
    required this.channel,
    required this.channels,
    required this.initialIndex,
    required this.sourceType,
    required this.sourceFilters,
    this.isMinimized = false,
    this.isOsPipMode = false,
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
  /// Max forward demuxer buffer (libmpv demuxer-max-bytes), in MiB
  final int demuxerMaxBytesMib;
  /// Max backward demuxer buffer (libmpv demuxer-max-back-bytes), in MiB
  final int demuxerMaxBackBytesMib;
  const PlaybackProfile({
    required this.name,
    required this.demuxerReadaheadSecs,
    required this.bufferSizeBytes,
    required this.startupTimeoutSecs,
    required this.stallTimeoutSecs,
    required this.preferredQuality,
    required this.demuxerMaxBytesMib,
    required this.demuxerMaxBackBytesMib,
  });
}

/// Stable (default): safe for most IPTV channels.
/// Larger buffer keeps player well behind live edge - avoids 404 on fresh segments.
const PlaybackProfile kStableProfile = PlaybackProfile(
  name: 'stable',
  demuxerReadaheadSecs: 30,
  bufferSizeBytes: 80 * 1024 * 1024,
  startupTimeoutSecs: 30,
  stallTimeoutSecs: 12,
  preferredQuality: 'auto',
  demuxerMaxBytesMib: 128,
  demuxerMaxBackBytesMib: 48,
);

/// Fast: lower latency, for known-stable channels only.
const PlaybackProfile kFastProfile = PlaybackProfile(
  name: 'fast',
  demuxerReadaheadSecs: 3,
  bufferSizeBytes: 32 * 1024 * 1024,
  startupTimeoutSecs: 18,
  stallTimeoutSecs: 8,
  preferredQuality: 'auto',
  demuxerMaxBytesMib: 32,
  demuxerMaxBackBytesMib: 16,
);

/// Data Saver: moderate buffer, starts at lower quality.
const PlaybackProfile kDataSaverProfile = PlaybackProfile(
  name: 'data_saver',
  demuxerReadaheadSecs: 6,
  bufferSizeBytes: 16 * 1024 * 1024,
  startupTimeoutSecs: 15,
  stallTimeoutSecs: 12,
  preferredQuality: '360p',
  demuxerMaxBytesMib: 32,
  demuxerMaxBackBytesMib: 16,
);

/// Web: browser-native HLS playback via media_kit MSE. Proxy delivers segments fast
/// so stall detection can be much quicker than native libmpv.
const PlaybackProfile kWebProfile = PlaybackProfile(
  name: 'web',
  demuxerReadaheadSecs: 8,
  bufferSizeBytes: 32 * 1024 * 1024,
  startupTimeoutSecs: 20,
  stallTimeoutSecs: 8,
  preferredQuality: 'auto',
  demuxerMaxBytesMib: 64,
  demuxerMaxBackBytesMib: 16,
);

/// Mobile (auto on Android/iOS): lighter buffer for variable mobile data connections.
/// 6s readahead = faster channel open; 32MB cap avoids RAM pressure on phones.
const PlaybackProfile kMobileProfile = PlaybackProfile(
  name: 'mobile',
  demuxerReadaheadSecs: 6,
  bufferSizeBytes: 32 * 1024 * 1024,
  startupTimeoutSecs: 20,
  stallTimeoutSecs: 10,
  preferredQuality: 'auto',
  demuxerMaxBytesMib: 32,
  demuxerMaxBackBytesMib: 16,
);

// ----
// Global singletons for Web to prevent media_kit_video double-initialization bugs (PromiseCompleter errors)
Player? _globalWebPlayer;
VideoController? _globalWebVideoController;

class _PlayerScreenState extends State<PlayerScreen> with TickerProviderStateMixin {
  final ApiService _api = ApiService();
  final LocalHlsProxy _hlsProxy = LocalHlsProxy();
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
  int _initId = 0; // Tracks initialization sequences to prevent concurrent media_kit worker overlaps
  int _lastReportedDisplayChannelId = -1;
  int _hasReportedPlaybackSuccessForSession = -1;
  int _mediaOpenCount = 0;
  String _mediaOpenReason = 'initial';
  int _consecutiveLowBandwidthSeconds = 0;
  bool _thermalSafeMode = false;
  String _playbackSessionId = '';
  String _displayRefreshRatePref = 'auto';
  bool _matchVideoFrameRatePref = true;
  double _currentVideoFps = 0.0;
  List<DisplayMode> _supportedDisplayModes = [];
  DisplayMode? _activeDisplayMode;

  List<dynamic> _backupStreams = [];
  Map<String, dynamic>? _currentStreamMeta;
  // Cache of headers from last successful playback API response. Used in the
  // catch-block fallback so we never rebuild headers from the stale channels table.
  Map<String, dynamic>? _lastApiHeaders;
  bool _isRetryingStream = false;
  String _streamOverlayMessage = '';
  /// Last libmpv/player error description, surfaced in the error overlay so the
  /// user sees WHY a stream failed instead of an infinite "Loading..." spinner.
  String _lastErrorDescription = '';
  /// Last failure reason code (init_timeout / buffer_timeout / player_error / ...).
  String _lastErrorReason = '';
  /// Last raw error string from media_kit's error stream (PlayerState has no
  /// `error` field in media_kit 1.2.x), used for on-screen diagnostics.
  String _lastPlayerError = '';
  /// Whether the underlying player native backend has been initialized/opened.
  /// PlayerState/Player expose no `isInitialized` in media_kit 1.2.x, so we track it.
  bool _playerInitialized = false;
  /// Toggles the on-screen diagnostics detail view in the error overlay (Option C).
  bool _showDiagDetails = false;
  
  // Dynamic Buffer Scaling & RUM Telemetry
  int _dynamicReadaheadSecs = 0;
  int _totalBufferingMs = 0;
  DateTime? _bufferingStartTime;
  
  // Player Overlay Control & Feature States
  bool _isLocked = false;
  bool _showLockHud = false;
  Timer? _lockHudTimer;
  double _volume = 100.0;
  double _brightness = 1.0;
  bool _showVolumeHud = false;
  bool _showBrightnessHud = false;
  Timer? _hudTimer;
  bool _isSpeedBoosted = false;
  int _sleepTimerMinutes = 0;
  Timer? _sleepTimer;
  DateTime? _sleepTimerEndTime;
  
  Timer? _bufferTimer;
  Timer? _startupTimer;
  Timer? _heartbeatTimer;

  void _startHeartbeatTimer() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (timer) async {
      final prefs = await SharedPreferences.getInstance();
      final deviceId = prefs.getString(StorageKeys.deviceId) ?? 'unknown';
      try {
        await _api.sendStreamHeartbeat(_currentChannel.id, deviceId, 'ping');
      } catch (e) {
        if (e.toString().contains('Device limit reached')) {
          timer.cancel();
          _player.stop();
          if (mounted) {
            setState(() {
              _hasError = true;
              _streamOverlayMessage = e.toString().replaceFirst('Exception: ', '');
            });
          }
        }
      }
    });
  }

  void _stopHeartbeatTimer() async {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    final prefs = await SharedPreferences.getInstance();
    final deviceId = prefs.getString(StorageKeys.deviceId) ?? 'unknown';
    _api.sendStreamHeartbeat(_currentChannel.id, deviceId, 'stop');
  }

  Timer? _webFirstFrameTimer;
  Timer? _reconnectTimer;
  Timer? _stablePlaybackTimer;
  Timer? _positionCheckTimer;
  Duration? _lastPosition;
  DateTime? _lastProgressAt;
  int _frozenSeconds = 0;
  int _directStartupAttempts = 0;
  int _proxyStartupAttempts = 0;
  int _runtimeRecoveryAttempts = 0;
  bool _directFailed = false;
  bool _proxyStarted = false;
  int _playbackGeneration = 0;
  bool _recoveryInProgress = false;
  bool _sourceStartupGrace = false;
  bool _userPaused = false;
  StreamSubscription? _playerSubscription;
  StreamSubscription? _playerLogSubscription;
  StreamSubscription? _playerErrorSubscription;
  StreamSubscription? _videoParamsSubscription;
  StreamSubscription? _audioParamsSubscription;
  StreamSubscription? _playerPlayingSubscription;
  StreamSubscription? _trackSubscription;
  bool _showDebugDiagnostics = kDebugMode;
  int _framesDropped = 0;
  int _framesDelayed = 0;
  String _activeVideoDecoder = 'unknown';
  bool _startupCompleted = false;
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
    final bool isMobile = !kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.android ||
         defaultTargetPlatform == TargetPlatform.iOS);
    switch (_playbackMode) {
      case PlaybackMode.fast:      return kFastProfile;
      case PlaybackMode.dataSaver: return kDataSaverProfile;
      case PlaybackMode.auto:
        if (kIsWeb) return kWebProfile;
        return isMobile ? kMobileProfile : kStableProfile;
      case PlaybackMode.stable:    return kStableProfile;
    }
  }

  // Proxy fallback state - populated from playback API response
  String? _proxyUrl;
  bool _proxyAttempted = false;
  Map<String, dynamic>? _proxyHeaders;

  // Hardware decode fallback: retry with hwdec=no when a codec error is detected.
  // Only attempted once per stream session to avoid loops.
  bool _hwdecSoftwareFallbackAttempted = false;

  // Tracks which path served the stream: 'direct' | 'proxy' | 'smooth' | 'transcode' | 'backup'
  String _playbackPath = 'direct';

  // Smooth Playback / Delayed Live state
  bool _smoothPlaybackEnabled = false;
  bool _bufferReady = false;
  int _delaySeconds = 0;
  int _requiredDelaySeconds = 0;
  int _bufferDepthSeconds = 0;
  String _bufferStatus = '';
  String? _directLiveUrl;
  bool _canGoLive = false;
  bool _showPreparingOverlay = false;
  // While warming a cold/channel on-demand, the player keeps playing the direct/live URL and
  // a small warming banner is shown instead of a full-screen spinner. The poll loop marks the
  // delayed URL as ready but does NOT swap mid-playback — the swap happens at the next natural
  // stall or channel open so the user never sees a disruptive reload.
  bool _switchedToSmooth = false;
  // Delayed-stream URL that is ready but not yet applied. Applied on next stall or channel open.
  String? _pendingSmoothUrl;
  Timer? _smoothWarmTimer;
  DateTime? _warmStartedAt;
  static const int _smoothWarmTimeoutSec = 180;

  // Buffer quality / gap warning state (skip-missing-chunks phase)
  bool _gapWarning = false;
  String _gapWarningMessage = '';
  String _bufferQualityStatus = 'clean_buffer';
  int _cleanBufferPercentage = 100;
  Timer? _gapWarningRefreshTimer;

  // Auto quality upgrade state
  bool _wasQualityDowngraded = false;
  Timer? _qualityUpgradeTimer;
  bool _qualityUpgradeLocked = false; // locked for session after failed upgrade
  // Number of quality downgrades this channel session. After 2 the quality is
  // locked — prevents the downgrade→3min-upgrade→stall→downgrade oscillation
  // where every switch is a full player re-open.
  int _downgradeCount = 0;
  // Probe window after a silent quality upgrade: any stall inside this window
  // means the upgrade failed → lock quality and step back down. The previous
  // implementation sampled _isLoading at exactly t+30s, so a stall at t+40s
  // escaped the lock and restarted the bounce cycle.
  DateTime? _upgradeProbeUntil;
  // Deferred HD promotion: force the top native track only after playback has
  // proven stable, never on open (forcing HD on open caused instant stalls on
  // connections that cannot sustain HD bitrate).
  Timer? _hdPromoteTimer;

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
  // ABR-style adaptive downgrade: fires when a single buffering stall lasts
  // several seconds — drop quality immediately instead of waiting for the
  // full stall timeout and a disruptive stream restart.
  Timer? _qualityStallTimer;

  // Slow connection overlay
  bool _showSlowConnectionOverlay = false;
  bool _slowOverlaySuppressedForSession = false;
  DateTime? _lastSlowWarningAt;
  Timer? _slowOverlayTimer;

  // In-player toast (replaces quality-switch SnackBars)
  String _playerToast = '';
  Timer? _playerToastTimer;

  // LIVE badge pulse animation state (red dot blinks every ~1s)
  bool _livePulseVisible = true;
  Timer? _livePulseTimer;

  // Startup Timeline Diagnostics
  DateTime? _channelTapTime;
  DateTime? _playbackApiStartTime;
  DateTime? _playbackApiEndTime;
  DateTime? _mediaOpenTime;
  DateTime? _firstVideoSignalTime;
  DateTime? _overlayHiddenTime;

  bool _reportedSuccessForGeneration = false;
  int _activeFetchId = 0;

  // Global static flag to prevent duplicate Wakelock JS injections on Web
  static bool _wakelockEnabled = false;

  // Duplicate Initialization Guard
  bool _initializationInProgress = false;
  String? _activePlaybackRequestId;

  // Channel-switch session ID — incremented on every channel selection.
  // Every async callback (API responses, player events, timers) checks this before
  // updating any state. Stale callbacks from the previous channel are silently dropped.
  int _channelSessionId = 0;
  bool _isStoppingPrevious = false;
  
  // Fix A: Silent retries
  int _silentRetryCount = 0;
  
  // Phase 7: Gentle Recovery — try pause/resume before nuking buffer
  int _gentleRecoveryAttempts = 0;
  
  // Fix C: Auto-retry state for Error UI
  Timer? _autoRetryTimer;
  int _autoRetryCountdown = 0;
  int _autoRetryAttempts = 0;

  // Fix E: Cache for API responses
  final Map<int, Map<String, dynamic>> _playbackApiCache = {};
  final Map<int, DateTime> _playbackApiCacheTime = {};

  void _startAutoRetryTimer() {
    _autoRetryTimer?.cancel();
    if (_autoRetryAttempts >= 3) return; // Stop after 3 auto retries
    _autoRetryCountdown = 15;
    _autoRetryTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_autoRetryCountdown > 0) {
          _autoRetryCountdown--;
        } else {
          timer.cancel();
          _autoRetryAttempts++;
          _retry(); // This just calls _fetchPlaybackAndInitialize()
        }
      });
    });
  }

  @override
  void initState() {
    super.initState();
    _hlsProxy.start();
    _channelTapTime = DateTime.now();
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

    // Calculate initial page limits. Use floor division so a partially-loaded
    // page is re-fetched (duplicates are filtered) instead of skipped —
    // e.g. 75 loaded channels must fetch page 2, not jump to page 3.
    final limit = 50; // standard limit
    _nextPage = (_contextChannels.length ~/ limit) + 1;
    _previousPage = 1;
    _hasMoreBefore = false;
    _hasMoreAfter = _sourceType == PlayerSourceType.liveTv ||
                     _sourceType == PlayerSourceType.category ||
                     _sourceType == PlayerSourceType.search;

    _currentUrl = _currentChannel.streamUrl;

    // Fix #1: Initialize media_kit player with optimized Netflix-style fast-start configuration
    if (kIsWeb) {
      if (_globalWebPlayer == null) {
        _globalWebPlayer = Player(
          configuration: PlayerConfiguration(
            bufferSize: kStableProfile.bufferSizeBytes,
            pitch: false,
            logLevel: MPVLogLevel.warn,
          ),
        );
        _globalWebVideoController = VideoController(_globalWebPlayer!);
      }
      _player = _globalWebPlayer!;
      _videoController = _globalWebVideoController!;
    } else {
      _player = Player(
        configuration: PlayerConfiguration(
          // Match the stable profile at startup. libmpv readahead is tuned per stream below.
          bufferSize: kStableProfile.bufferSizeBytes,
          // Disable pitch shifting to save CPU during startup
          pitch: false,
          logLevel: MPVLogLevel.warn,
        ),
      );
      _videoController = VideoController(_player);
    }

    // Fix #9: Keep screen on during playback
    if (!kIsWeb || !_wakelockEnabled) {
      WakelockPlus.enable();
      _wakelockEnabled = true;
    }

    _controlsAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _controlsOpacity = CurvedAnimation(parent: _controlsAnimController, curve: Curves.easeInOut);
    _controlsAnimController.forward();

    context.read<FavoriteCubit>().loadFavorites();
    StorageService().saveWatchHistory(_currentChannel);
    _scrollController.addListener(_onScroll);
    _loadQualitySettingsAndFetch();
    
    // Fix: Defer secondary network requests (EPG, Related Channels) until after the first frame
    // is rendered, prioritizing bandwidth for the critical HLS startup sequence.
    // _loadChannelData();
    // _updateMoreChannelsFromContext();

    // Start LIVE badge red-dot pulse (alternates every 900ms)
    _livePulseTimer = Timer.periodic(const Duration(milliseconds: 900), (_) {
      if (mounted) setState(() { _livePulseVisible = !_livePulseVisible; });
    });
  }

  @override
  void didUpdateWidget(PlayerScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.channel.id != widget.channel.id) {
      _stopHeartbeatTimer();
      _bufferTimer?.cancel();
      _startupTimer?.cancel();
      _reconnectTimer?.cancel();
      _positionCheckTimer?.cancel();
      _stablePlaybackTimer?.cancel();
      
      _player.stop();
      
      setState(() {
        _channelTapTime = DateTime.now();
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
        
        final limit = 50;
        _nextPage = (_contextChannels.length ~/ limit) + 1;
        _previousPage = 1;
        _hasMoreBefore = false;
        _hasMoreAfter = _sourceType == PlayerSourceType.liveTv ||
                         _sourceType == PlayerSourceType.category ||
                         _sourceType == PlayerSourceType.search;
                         
        _isLoading = true;
        _hasError = false;
        _isRetryingStream = false;
        _streamOverlayMessage = '';
        _proxyAttempted = false;
        _directFailed = false;
        _playbackSessionId = DateTime.now().millisecondsSinceEpoch.toString();
        _playStartTime = null;

        _startupCompleted = false;
        _hadFailureBeforePlaying = false;
        _lastErrorDescription = '';
        _lastErrorReason = '';
        _lastPlayerError = '';
        _mediaOpenCount = 0;
        _totalBufferingMs = 0;
        _currentUrl = _currentChannel.streamUrl;
        
        StorageService().saveWatchHistory(_currentChannel);
      });
      
      _loadQualitySettingsAndFetch();
    }
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

    _displayRefreshRatePref = await storage.getDisplayRefreshRate();
    _matchVideoFrameRatePref = await storage.getMatchVideoFrameRate();

    if (!kIsWeb && Platform.isAndroid) {
      try {
        _supportedDisplayModes = await FlutterDisplayMode.supported;
        _activeDisplayMode = await FlutterDisplayMode.active;
        _applyUiDisplayMode();
      } catch (_) {}
    }

    _fetchPlaybackAndInitialize();
  }

  Future<void> _applyUiDisplayMode() async {
    if (kIsWeb || !Platform.isAndroid || _supportedDisplayModes.isEmpty) return;
    try {
      if (_displayRefreshRatePref == '120') {
        await FlutterDisplayMode.setHighRefreshRate();
      } else if (_displayRefreshRatePref == '90') {
        final modes = _supportedDisplayModes.where((m) => m.refreshRate > 89 && m.refreshRate < 100).toList();
        if (modes.isNotEmpty) {
          modes.sort((a, b) => b.refreshRate.compareTo(a.refreshRate));
          await FlutterDisplayMode.setPreferredMode(modes.first);
        } else {
          await FlutterDisplayMode.setHighRefreshRate();
        }
      } else if (_displayRefreshRatePref == '60') {
        await FlutterDisplayMode.setLowRefreshRate();
      } else {
        await FlutterDisplayMode.setPreferredMode(DisplayMode.auto);
      }
      _activeDisplayMode = await FlutterDisplayMode.active;
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _applyContentFrameRateMatching() async {
    if (kIsWeb || !Platform.isAndroid || !_matchVideoFrameRatePref || _currentVideoFps <= 0) {
      return _applyUiDisplayMode();
    }
    
    try {
      DisplayMode? bestMode;
      for (final mode in _supportedDisplayModes) {
        final hz = mode.refreshRate;
        final multiple = hz / _currentVideoFps;
        final diff = (multiple - multiple.round()).abs();
        
        if (diff < 0.05) { 
          if (bestMode == null || hz > bestMode.refreshRate) {
             bestMode = mode;
          }
        }
      }
      
      if (bestMode != null) {
        await FlutterDisplayMode.setPreferredMode(bestMode);
        _activeDisplayMode = await FlutterDisplayMode.active;
        if (mounted) setState(() {});
      } else {
        _applyUiDisplayMode();
      }
    } catch (_) {
      _applyUiDisplayMode();
    }
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
    if (_lastReportedDisplayChannelId == _currentChannel.id) return;
    try {
      await _api.post(ApiEndpoints.channelDisplayReportPath(_currentChannel.id), {
        'aspect_ratio_type': _detectedAspectRatioType,
        'video_width': _detectedVideoWidth,
        'video_height': _detectedVideoHeight,
        'detected_fit_mode': _autoDetectedFitMode,
      });
      _lastReportedDisplayChannelId = _currentChannel.id;
    } catch (_) {}
  }

  Map<String, dynamic>? _determineInitialQuality() {
    if (_qualities.isEmpty) return null;

    bool restrictToSD = _dataSaverEnabled || (_autoMobileData && _isOnMobileData);
    bool blockHD = _hdOnlyWifi && _isOnMobileData;

    // Dead statuses that should never be selected for playback
    const Set<String> deadStatuses = {'segment_failed', 'offline', 'dead', 'forbidden_403', 'geo_blocked'};

    List<dynamic> allowed = _qualities.where((q) {
      // Skip any quality variant with a known-dead health status
      final hs = q['health_status'] as String?;
      if (hs != null && deadStatuses.contains(hs)) return false;
      if (q['type'] == 'auto') return restrictToSD == false; // Prefer explicit SD variants if restricted
      int h = q['height'] ?? 0;
      if (restrictToSD && h > 480) return false;
      if (blockHD && h >= 720) return false;
      return true;
    }).toList();

    if (allowed.isEmpty) allowed = _qualities; // Fallback to all if everything filtered out

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
    final bool wasReady = _bufferReady;
    try {
      final res = await _api.get(ApiEndpoints.channelSmoothPlaybackPath(_currentChannel.id));
      if (res['success'] == true) {
        final d = res['data'];
        final mode = d['playback_mode'] as String? ?? 'direct';
        if (mode == 'delayed') {
          _smoothPlaybackEnabled = true;
          _delaySeconds = (d['delay_seconds'] as num?)?.toInt() ?? 300;
          _requiredDelaySeconds = (d['required_delay_seconds'] as num?)?.toInt() ?? _delaySeconds;
          _bufferDepthSeconds = (d['buffer_depth_seconds'] as num?)?.toInt() ?? 0;
          _bufferReady = d['buffer_ready'] == true;
          _bufferStatus = d['buffer_status'] as String? ?? 'warming_up';
          _directLiveUrl = d['direct_live_url'] as String?;
          _canGoLive = d['can_go_live'] == true;
          final statusMessage = d['message'] as String?;

          // Parse buffer quality / gap warning fields
          _gapWarning = d['gap_warning'] == true;
          _gapWarningMessage = d['gap_warning_message'] as String? ?? '';
          _bufferQualityStatus = d['buffer_quality_status'] as String? ?? 'clean_buffer';
          _cleanBufferPercentage = (d['clean_buffer_percentage'] as num?)?.toInt() ?? 100;

          if (_bufferReady) {
            // Override stream URL with delayed buffer URL
            final delayedUrl = d['delayed_stream_url'] as String?;
            if (delayedUrl != null && delayedUrl.isNotEmpty) {
              _currentStreamMeta = {'url': delayedUrl, 'headers': {}};
              if (mounted) setState(() { _showPreparingOverlay = false; });
            }
            // Stop the warming poll loop — buffer is ready.
            _smoothWarmTimer?.cancel();
            _smoothWarmTimer = null;
            // Buffer just became ready: store the delayed URL but do NOT swap now.
            // Swapping mid-playback causes libmpv to restart the pipeline, producing a
            // visible stutter. Instead, we apply it at the next natural stall/pause or
            // the next time this channel is opened.
            if (!wasReady && !_switchedToSmooth && delayedUrl != null && delayedUrl.isNotEmpty) {
              _pendingSmoothUrl = delayedUrl;
            }
            // When buffer is ready but quality is degraded, start a refresh timer
            // so the banner clears automatically once the channel recovers.
            _startGapWarningRefreshIfNeeded();
          } else {
            // Buffer warming up. The player keeps playing the direct/live URL underneath and we
            // show a small warming banner (not a full-screen spinner) via _buildWarmingBanner.
            _warmStartedAt ??= DateTime.now();
            if (mounted) {
              setState(() {
                _showPreparingOverlay = true;
                _streamOverlayMessage = statusMessage ?? 'Preparing smooth playback...';
              });
            }

            // Show specific status messages based on buffer status
            if (_bufferStatus == 'source_timeout' || _bufferStatus == 'trying_backup') {
              _streamOverlayMessage = statusMessage ?? 'Channel source is unstable. Trying another source...';
            } else if (_bufferStatus == 'no_working_source') {
              _streamOverlayMessage = statusMessage ?? 'Stream unavailable. No stable source is available right now.';
            } else if (_bufferStatus == 'backup_active') {
              _streamOverlayMessage = statusMessage ?? 'Using backup source. Building buffer...';
            }

            // Start the poll loop so we notice when the buffer becomes ready and so the
            // progress banner ticks. Terminal failure states stop the loop.
            if (_bufferStatus != 'no_working_source' &&
                _bufferStatus != 'requires_licensed_source') {
              _startSmoothWarmPoll();
            } else {
              _smoothWarmTimer?.cancel();
              _smoothWarmTimer = null;
            }
          }
        } else if (mode == 'requires_licensed_source') {
          _smoothPlaybackEnabled = true;
          _bufferReady = false;
          _bufferStatus = 'requires_licensed_source';
          _showPreparingOverlay = false;
          _streamOverlayMessage = d['message'] as String? ?? 'No stable source is available right now.';
          _smoothWarmTimer?.cancel();
          _smoothWarmTimer = null;
        } else {
          _smoothPlaybackEnabled = false;
          _showPreparingOverlay = false;
          _gapWarning = false;
          _gapWarningMessage = '';
          _smoothWarmTimer?.cancel();
          _smoothWarmTimer = null;
        }
      }
    } catch (_) {
      // Smooth playback info unavailable — continue with direct stream
      _smoothPlaybackEnabled = false;
    }
  }

  /// Smooth playback warm poll is DISABLED — buffer recording is off.
  void _startSmoothWarmPoll() {
    // No-op: smooth playback is disabled, nothing to poll.
    return;
  }

  /// Compact, human-readable warming progress string for the banner / fallback spinner.
  /// Uses the configured delay (5-min/2-min label) and live buffer depth, never a
  /// hardcoded minute value.
  String _warmingProgressText() {
    final delay = _requiredDelaySeconds > 0 ? _requiredDelaySeconds : _delaySeconds;
    final mins = delay ~/ 60;
    final label = mins >= 1 ? '$mins-min' : '$delay-sec';
    final isUnstable = _bufferStatus == 'source_timeout' ||
        _bufferStatus == 'trying_backup' ||
        _bufferStatus == 'backup_active' ||
        _bufferStatus == 'no_working_source' ||
        _bufferStatus == 'warm_timeout';
    if (isUnstable) {
      return _streamOverlayMessage.isNotEmpty
          ? _streamOverlayMessage
          : 'Channel source is unstable. Trying another source...';
    }
    final depth = _bufferDepthSeconds < 0 ? 0 : _bufferDepthSeconds;
    final cappedDepth = depth > delay ? delay : depth;
    return 'Building $label buffer: ${cappedDepth}s / ${delay}s';
  }

  /// Whether the player is currently showing the direct/live URL underneath the warming
  /// banner (the "start like TV" mode). True only when smooth is enabled, not ready, and
  /// the direct stream is actually playing — so we render the small banner, not a spinner.
  bool get _warmingOverLive => false;

  /// Whether a normal direct/live stream is available to play immediately while warming,
  /// so we show a small banner over live video instead of a full-screen "Preparing" spinner.
  /// False when the primary stream is missing — then the full-screen preparing UI is correct.
  bool get _hasPlayableDirectStream =>
      _currentStreamMeta != null &&
      _currentStreamMeta!['url'] != null &&
      (_currentStreamMeta!['url'] as String).isNotEmpty;

  /// Switch from warming to direct/live playback on user request (Play Direct Live),
  /// abandoning the smooth delayed stream for this session.
  void _goLiveFromWarming() {
    _smoothWarmTimer?.cancel();
    _smoothWarmTimer = null;
    final url = _directLiveUrl;
    if (url == null || url.isEmpty) return;
    if (mounted) {
      setState(() {
        _smoothPlaybackEnabled = false;
        _bufferReady = false;
        _showPreparingOverlay = false;
        _streamOverlayMessage = '';
      });
    }
    _initializePlayer(url, {});
    _showPlayerToast('Switched to Live');
  }

  /// Returns true if the error message looks like a hardware-decode or codec failure.
  bool _looksLikeCodecError(String msg) {
    final lower = msg.toLowerCase();
    return lower.contains('codec') ||
        lower.contains('hevc') ||
        lower.contains('h265') ||
        lower.contains('h.265') ||
        lower.contains('hardware') ||
        lower.contains('hwdec') ||
        lower.contains('vdpau') ||
        lower.contains('vaapi') ||
        lower.contains('mediacodec') ||
        lower.contains('decoder') ||
        lower.contains('decoding failed') ||
        lower.contains('video output') ||
        lower.contains('unsupported stream');
  }

  /// Retry current URL with software decode (hwdec=no) — used when hardware decode fails.
  Future<void> _retryWithSoftwareDecode(String url, Map<String, dynamic>? rawHeaders) async {
    if (!mounted) return;
    setState(() { _streamOverlayMessage = 'Loading...'; _isLoading = true; _hasError = false; });
    try {
      final platform = _player.platform;
      if (platform.runtimeType.toString().contains('NativePlayer') ||
          platform.runtimeType.toString().contains('LibmpvPlayer')) {
        await (platform as dynamic).setProperty('hwdec', 'no');
      }
    } catch (_) {}
    await _initializePlayer(url, rawHeaders);
  }

  /// Gap warning refresh is DISABLED — smooth playback is off, no polling needed.
  void _startGapWarningRefreshIfNeeded() {
    // No-op: smooth playback is disabled.
    _gapWarningRefreshTimer?.cancel();
    _gapWarningRefreshTimer = null;
  }

  Future<void> _fetchPlaybackAndInitialize() async {
    if (_initializationInProgress) {
      _playerDebugLog('playback_initialization_aborted_already_in_progress', {
        'channel_id': _currentChannel.id,
      });
      return;
    }
    _initializationInProgress = true;
    _activePlaybackRequestId = '${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecond}';

    final int myFetchId = ++_activeFetchId;
    final int mySession = _channelSessionId; // Capture session at start of fetch
    
    // Fix #3: Cancel any pending buffer timer before starting a new stream to prevent
    // the old channel's timeout from firing and setting _isRetryingStream on the new one.
    // Note: most of these are already cancelled in _onChannelChanged, but this is a safety net
    // for cases where _fetchPlaybackAndInitialize is called independently (e.g. quality retry).
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
    _playerPlayingSubscription?.cancel();
    _playerPlayingSubscription = null;

    // Reset proxy + upgrade state for new channel
    _proxyUrl = null;
    _proxyAttempted = false;
    _proxyHeaders = null;
    _wasQualityDowngraded = false;
    _hwdecSoftwareFallbackAttempted = false;
    _hadFailureBeforePlaying = false;
    _qualityUpgradeTimer?.cancel();
    _qualityUpgradeTimer = null;

    if (mounted) setState(() { _isLoading = true; _hasError = false; _streamOverlayMessage = 'Loading channel...'; _isRetryingStream = false; });
    _playerDebugLog('playback_api_started', {
      'channel_id': _currentChannel.id,
      'channel_name': _currentChannel.name,
      'request_id': _activePlaybackRequestId,
      'session_id': null,
    });
    _playbackApiStartTime = DateTime.now();
    try {
      Map<String, dynamic>? data;
      final cacheAge = _playbackApiCacheTime[_currentChannel.id];
      if (cacheAge != null && DateTime.now().difference(cacheAge).inSeconds < 30) {
        data = _playbackApiCache[_currentChannel.id];
      }
      
      if (data == null) {
        final res = await _api.get(ApiEndpoints.channelPlaybackPath(_currentChannel.id));
        // Abort if a new fetch started OR if the user already switched channels
        if (_activeFetchId != myFetchId || _channelSessionId != mySession) {
          _initializationInProgress = false;
          _playerDebugLog('stale_callback_ignored', {
            'reason': 'playback_api_superseded',
            'my_session': mySession,
            'current_session': _channelSessionId,
          });
          return;
        }
        if (res['success'] == true) {
          data = res['data'];
          _playbackApiCache[_currentChannel.id] = data!;
          _playbackApiCacheTime[_currentChannel.id] = DateTime.now();
        }
      }
      
      _playbackApiEndTime = DateTime.now();
      _playerDebugLog('playback_api_completed', {
        'channel_id': _currentChannel.id,
        'request_id': _activePlaybackRequestId,
        'duration_ms': _playbackApiEndTime!.difference(_playbackApiStartTime!).inMilliseconds,
      });
      if (data != null) {
        _currentStreamMeta = data['primary_stream'];
        _backupStreams = List<dynamic>.from(data['backup_streams'] ?? []);
        _qualities = List<dynamic>.from(data['qualities'] ?? []);

        // Parse new fields from enhanced playback API
        _playbackSessionId = data['session_id'] as String? ?? _playbackSessionId;
        // proxy_url is null when DRM/geo-blocked/hidden/unlicensed — never try proxy then
        _proxyUrl = data['proxy_url'] as String?;

        // Proxy strategy:
        // - Web: use proxy as primary to avoid browser CORS blocks on CDN segment fetches.
        // - Mobile/native: go DIRECT first (CDN → phone is faster than CDN → server → phone).
        //   The proxy is available as a last-resort fallback in _recoverPlayback for
        //   mobile users whose ISP throttles/blocks certain CDNs.
        // Using proxy as primary for mobile was causing widespread buffering because every
        // segment was routed through the backend server, overloading it under normal load.
        String? webPreferredUrl;
        Map<String, dynamic>? webPreferredHeaders;
        if (kIsWeb && _proxyUrl != null) {
          final prefs = await SharedPreferences.getInstance();
          final token = prefs.getString(StorageKeys.token);
          if (token != null) {
            final separator = _proxyUrl!.contains('?') ? '&' : '?';
            _proxyUrl = '$_proxyUrl${separator}sid=$_playbackSessionId';
          }
          webPreferredUrl = _proxyUrl;
          webPreferredHeaders = {
            if (token != null) 'Authorization': 'Bearer $token',
          };
          _proxyHeaders = webPreferredHeaders;
          _playerDebugLog('proxy_preferred_web', {
            'channel_id': _currentChannel.id,
            'proxy_url': _proxyUrl,
            'has_token': token != null,
          });
        } else if (!kIsWeb && _proxyUrl != null) {
          // Pre-compute proxy headers for the fallback cascade on mobile.
          // The proxy itself is NOT used now; headers are ready if _recoverPlayback uses it.
          final prefs = await SharedPreferences.getInstance();
          final token = prefs.getString(StorageKeys.token);
          if (token != null) {
            final separator = _proxyUrl!.contains('?') ? '&' : '?';
            _proxyUrl = '$_proxyUrl${separator}sid=$_playbackSessionId';
          }
          _proxyHeaders = {
            if (token != null) 'Authorization': 'Bearer $token',
          };
        }

        _playerDebugLog('playback_api_response', {
          'channel_id': _currentChannel.id,
          'playback_mode': data['primary_stream']?['playback_mode'],
          'health_status': data['health_status'],
          'selected_stream_url': data['primary_stream']?['url'],
          'direct_live_url': data['direct_live_url'],
          'proxy_url': _proxyUrl,
          'smooth_playback_enabled': data['smooth_playback_enabled'],
          'smooth_stream_url': data['smooth_stream_url'],
          'buffer_ready': data['buffer_ready'],
          'buffer_depth_seconds': data['buffer_depth_seconds'],
        });

        // Smooth playback is disabled — skip the smooth-playback endpoint poll entirely.
        // The server always returns 'direct' mode, so there is nothing to fetch.
        // (Previously: await _fetchSmoothPlayback();)

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
        String urlToPlay;
        Map<String, dynamic>? headersToUse;
        
        final prefs = await SharedPreferences.getInstance();
        final String streamId = _currentStreamMeta?['id']?.toString() ?? '';
        final String? prefPath = streamId.isNotEmpty ? prefs.getString('pref_path_${_currentChannel.id}_$streamId') : null;
        final recommendation = data['recommendation'];

        if (webPreferredUrl != null) {
          urlToPlay = webPreferredUrl;
          headersToUse = webPreferredHeaders;
          _playbackPath = 'proxy';
          _proxyAttempted = true;
          _proxyStartupAttempts++;
        } else if (!kIsWeb && prefPath == 'proxy' && _proxyUrl != null) {
          _playerDebugLog('preferred_path_used', {'path': 'proxy', 'stream_id': streamId, 'reason': 'local_preference'});
          urlToPlay = _proxyUrl!;
          headersToUse = _proxyHeaders;
          _playbackPath = 'proxy';
          _proxyAttempted = true;
          _proxyStartupAttempts++;
        } else if (!kIsWeb && recommendation != null && recommendation['preferred_mode'] == 'proxy' && _proxyUrl != null) {
          _playerDebugLog('alternate_path_selected', {'path': 'proxy', 'stream_id': streamId, 'reason': recommendation['reason']});
          urlToPlay = _proxyUrl!;
          headersToUse = _proxyHeaders;
          _playbackPath = 'proxy';
          _proxyAttempted = true;
          _proxyStartupAttempts++;
        } else if (_selectedQuality != null && _selectedQuality!['url'] != null) {
          urlToPlay = _selectedQuality!['url'];
          headersToUse = _selectedQuality!['headers'];
          _playbackPath = 'direct';
        } else if (_currentStreamMeta != null && _currentStreamMeta!['url'] != null) {
          urlToPlay = _currentStreamMeta!['url'];
          headersToUse = _currentStreamMeta!['headers'];
          _playbackPath = 'direct';
        } else {
          throw Exception('No stream URL in playback response');
        }
        // Cache API-returned headers so the catch fallback uses the same source of truth.
        _lastApiHeaders = headersToUse;

        // Concurrent Stream Limit Check
        final prefsDeviceId = await SharedPreferences.getInstance();
        final deviceId = prefsDeviceId.getString(StorageKeys.deviceId) ?? 'unknown';
        try {
          await _api.sendStreamHeartbeat(_currentChannel.id, deviceId, 'start');
        } catch (e) {
          if (e.toString().contains('Device limit reached')) {
            if (mounted) {
              setState(() {
                _isLoading = false;
                _hasError = true;
                _showPreparingOverlay = false;
                _streamOverlayMessage = e.toString().replaceFirst('Exception: ', '');
              });
            }
            return;
          }
        }

        await _initializePlayer(urlToPlay, headersToUse);
      } else {
        throw Exception('Playback fetch failed');
      }
    } catch(e) {
      _playerDebugLog('playback_api_failed', {
        'channel_id': _currentChannel.id,
        'error': e.toString(),
      });
      if (mounted) {
        String msg = 'Playback service unavailable.\nPlease try again later.';
        
        // Handle 403 upgrade_required specifically
        if (e is DioException && (e as DioException).response?.statusCode == 403) {
          final data = (e as DioException).response?.data;
          if (data != null && data['error_code'] == 'upgrade_required') {
            msg = data['message'] ?? 'Upgrade your plan to watch this channel.';
            // We can also trigger the upgrade dialog directly
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _showUpgradeDialog(msg);
            });
          } else {
             msg = data?['message'] ?? msg;
          }
        }

        setState(() {
          _isLoading = false;
          _hasError = true;
          _showPreparingOverlay = false;
          _streamOverlayMessage = msg;
        });
      }
      return;
    } finally {
      _initializationInProgress = false;
    }
  }

  void _showUpgradeDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(AppColors.surface),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.workspace_premium, color: Colors.amber),
            SizedBox(width: 8),
            Text('Upgrade Required', style: TextStyle(color: Colors.white, fontSize: 20)),
          ],
        ),
        content: Text(
          message,
          style: const TextStyle(color: Colors.white70),
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
              ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please contact support to upgrade your plan.')));
            },
            child: const Text('Upgrade', style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );
  }

  void _onStartupSuccess(String sourceTrigger, int generation) async {
    if (!mounted || _playbackGeneration != generation || _startupCompleted) return;
    
    _firstVideoSignalTime ??= DateTime.now();
    _startupCompleted = true;
    _startupTimer?.cancel();
    _startupTimer = null;
    _webFirstFrameTimer?.cancel();
    _webFirstFrameTimer = null;
    _sourceStartupGrace = false;

    _playerDebugLog('startup_completed', {
      'channel_id': _currentChannel.id,
      'trigger': sourceTrigger,
      'generation': generation,
      'timeline_ms': {
        'tap_to_api_start': _playbackApiStartTime != null && _channelTapTime != null ? _playbackApiStartTime!.difference(_channelTapTime!).inMilliseconds : -1,
        'api_duration': _playbackApiEndTime != null && _playbackApiStartTime != null ? _playbackApiEndTime!.difference(_playbackApiStartTime!).inMilliseconds : -1,
        'api_to_media_open': _mediaOpenTime != null && _playbackApiEndTime != null ? _mediaOpenTime!.difference(_playbackApiEndTime!).inMilliseconds : -1,
        'media_open_to_first_signal': _firstVideoSignalTime != null && _mediaOpenTime != null ? _firstVideoSignalTime!.difference(_mediaOpenTime!).inMilliseconds : -1,
        'total_tap_to_first_signal': _firstVideoSignalTime != null && _channelTapTime != null ? _firstVideoSignalTime!.difference(_channelTapTime!).inMilliseconds : -1,
      }
    });

    // Defer secondary network requests (EPG, Related Channels) to avoid CPU/network contention during initial playback
    Timer(const Duration(seconds: 3), () {
      if (mounted) {
        _loadChannelData();
        _updateMoreChannelsFromContext();
      }
    });

    setState(() {
      _isRetryingStream = false;
      _isLoading = false;
      _hasError = false;
      _streamOverlayMessage = '';
    });
    
    _playStartTime ??= DateTime.now();
    _overlayHiddenTime = DateTime.now();
    _showControlsWithTimer();
    
    if (!_reportedSuccessForGeneration) {
      _reportedSuccessForGeneration = true;
      _reportPlaybackSuccess();
    }
    
    _startHeartbeatTimer();

    // Phase 2b: Background Buffer Build — now that first frame is on screen,
    // boost the buffer to 15s readahead and 32MB stream buffer for smooth
    // sustained playback (YouTube-style two-phase buffering).
    try {
      final platform = _player.platform;
      if (!kIsWeb && (platform.runtimeType.toString().contains('NativePlayer') ||
          platform.runtimeType.toString().contains('LibmpvPlayer'))) {
        _dynamicReadaheadSecs = 15;
        await (platform as dynamic).setProperty('demuxer-readahead-secs', '15');
        await (platform as dynamic).setProperty('stream-buffer-size', '33554432');
        _playerDebugLog('phase2b_buffer_boost', {'readahead': 15, 'stream_buffer': '32MB'});
      }
    } catch (_) {}

    // Phase 5: Prefetch playback API for next 2 channels in the background
    _prefetchAdjacentPlaybackApis();
    
    // Remember successful path!
    if (_currentStreamMeta != null) {
      final streamId = _currentStreamMeta!['id']?.toString() ?? '';
      if (streamId.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('pref_path_${_currentChannel.id}_$streamId', _playbackPath);
      }
    }
  }

  /// Phase 5: Prefetch playback API for the next 2 channels in the list
  /// so channel switching is near-instant (cache hit instead of API call).
  void _prefetchAdjacentPlaybackApis() async {
    for (int offset = 1; offset <= 2; offset++) {
      final idx = _currentIndex + offset;
      if (idx >= _contextChannels.length) break;
      final ch = _contextChannels[idx];
      // Skip if already cached and fresh
      final cacheAge = _playbackApiCacheTime[ch.id];
      if (cacheAge != null && DateTime.now().difference(cacheAge).inSeconds < 60) continue;
      try {
        final res = await _api.get(ApiEndpoints.channelPlaybackPath(ch.id));
        if (res['success'] == true && res['data'] != null) {
          _playbackApiCache[ch.id] = res['data'];
          _playbackApiCacheTime[ch.id] = DateTime.now();
          _playerDebugLog('prefetch_api_cached', {'channel_id': ch.id, 'offset': offset});
        }
      } catch (_) {}
    }
  }

  Future<void> _initializePlayer(String url, [Map<String, dynamic>? rawHeaders, Duration? startPosition]) async {
    _currentUrl = url;
    final int myInitId = ++_initId;
    _reportedSuccessForGeneration = false;
    _mediaOpenTime = null;
    _firstVideoSignalTime = null;
    _overlayHiddenTime = null;
    
    try {
      // Prevent rapid-switch crashes on Web: wait for the previous stream to completely stop 
      // before destroying its subscriptions and opening a new one.
      await _player.stop();
    } catch (_) {}
    
    // If another initialize request started while we were stopping, abort this one silently
    if (_initId != myInitId) return;

    _playerSubscription?.cancel();
    _playerSubscription = null;
    _playerErrorSubscription?.cancel();
    _playerErrorSubscription = null;
    _videoParamsSubscription?.cancel();
    _videoParamsSubscription = null;
    _audioParamsSubscription?.cancel();
    _audioParamsSubscription = null;
    _playerPlayingSubscription?.cancel();
    _playerPlayingSubscription = null;
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _startupTimer?.cancel();
    _startupTimer = null;
    _qualityStallTimer?.cancel();
    _qualityStallTimer = null;
    _stablePlaybackTimer?.cancel();
    _stablePlaybackTimer = null;
    _positionCheckTimer?.cancel();
    _positionCheckTimer = null;
    _frozenSeconds = 0;
    _lastPosition = null;
    // Fix #4: Cancel any pending error grace timer when reinitializing — prevents a delayed
    // error from a previous stream from triggering failure on the newly loaded stream.
    _errorGraceTimer?.cancel();
    _errorGraceTimer = null;
    _playerErrorPending = false;
    _playStartTime = null;
    if (mounted) setState(() { _isLoading = true; _hasError = false; _lastErrorDescription = ''; _lastErrorReason = ''; _lastPlayerError = ''; _showDiagDetails = false; _playerInitialized = false; if (_streamOverlayMessage.isEmpty) _streamOverlayMessage = 'Loading...'; });

    _playbackGeneration++;
    final int thisGeneration = _playbackGeneration;
    _startupCompleted = false;
    _sourceStartupGrace = true;
    _recoveryInProgress = false;
    _userPaused = false;
    _lastProgressAt = DateTime.now();

    _playerDebugLog('source_open_requested', {
      'channel_id': _currentChannel.id,
      'url': url,
      'generation': _playbackGeneration,
      'session_id': _playbackSessionId,
      'media_open_count': _mediaOpenCount,
      'media_open_reason': _mediaOpenReason,
    });

    try {
      // -- Apply profile-based libmpv tuning --------------------------------
      // media_kit / libmpv only. No ExoPlayer/Media3. No seek() on live streams.
      final profile = _activeProfile;
      // The backend delayed (smooth) stream serves segments recorded minutes
      // behind live, so unlike a raw live URL there is always deep content
      // available ahead of the playhead — buffer it aggressively (YouTube-style)
      // so short network dips never reach the screen.
      final bool isDelayedStream = url.contains('/api/smooth/');
      // Phase 2: Instant-Start Buffering — use minimal readahead to show first
      // frame ASAP. _onStartupSuccess will boost this to 15s once playing.
      final int fastStartReadahead = isDelayedStream ? 30 : 1;
      _dynamicReadaheadSecs = fastStartReadahead;
      final int demuxerMaxBytesMib = isDelayedStream
          ? (profile.demuxerMaxBytesMib < 96 ? 96 : profile.demuxerMaxBytesMib)
          : profile.demuxerMaxBytesMib;
      try {
        final platform = _player.platform;
        if (platform.runtimeType.toString().contains('NativePlayer') ||
            platform.runtimeType.toString().contains('LibmpvPlayer')) {
          // Phase 2: Instant-Start — minimal readahead for fast first frame
          await (platform as dynamic).setProperty(
              'demuxer-readahead-secs', '$_dynamicReadaheadSecs');
          // cache-secs: keep generous for background buffer building
          await (platform as dynamic).setProperty(
              'cache-secs', '60');
          await (platform as dynamic).setProperty('cache', 'yes');
          // Bound the demuxer byte buffer so live streams don't balloon RAM.
          await (platform as dynamic).setProperty(
              'demuxer-max-bytes', '${demuxerMaxBytesMib}MiB');
          await (platform as dynamic).setProperty(
              'demuxer-max-back-bytes', '${profile.demuxerMaxBackBytesMib}MiB');
          // Seamless Live Playback: Keep playback flowing smoothly without artificial pauses
          await (platform as dynamic).setProperty('cache-pause', 'no');
          await (platform as dynamic).setProperty('cache-pause-initial', 'no');

          // Keep the player alive at stream end (HLS live streams return EOF between
          // playlist windows). Without this, media_kit disposes the player on EOF.
          await (platform as dynamic).setProperty('keep-open', 'yes');
          await (platform as dynamic).setProperty('keep-open-pause', 'no');
          // Auto-reconnect on network stall — never use seek() on live streams.
          // reconnect_on_network_errors=1 reconnects on TCP-level drops, not just EOF.
          // reconnect_delay_max=5: Indian CDNs may need up to 5s between reconnects.
          // timeout=30s: segment servers on IPTV CDNs can take 20-25s to respond.
          // tls_verify=no: libmpv on Android does NOT share Chrome's system CA store,
          //   so HTTPS HLS/ts streams fail with a silent TLS error and the player
          //   hangs on buffering forever. Disabling verification lets the same HTTPS
          //   streams that work in Flutter Web play on Android too. (Debug/testing.)
          // user_agent: many IPTV origins (and the backend proxy) 403 requests that
          //   lack a browser-like User-Agent. Web sends one automatically; libmpv
          //   does not, so we set a sensible default here as a backstop. The
          //   per-stream httpHeaders (if any) override this at the Media level.
          // Phase 8: Connection Keep-Alive — multiple_requests=1 for HTTP keep-alive
          await (platform as dynamic).setProperty(
              'stream-lavf-o',
              'reconnect=1,reconnect_at_eof=1,reconnect_streamed=1,'
              'reconnect_on_network_errors=1,reconnect_delay_max=5,'
              'multiple_requests=1,'
              'timeout=30000000,tls_verify=no,'
              'user_agent=Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 '
              '(KHTML, like Gecko) NivaTV/1.2.1 Chrome/120.0 Mobile Safari/537.36');
          // network-timeout removed: timeout=30000000 in stream-lavf-o already sets 30s
          // at the lavf layer; a conflicting network-timeout value can cause unexpected races.
          // IPTV HLS sources often need permissive playlist loading.
          try {
            await (platform as dynamic).setProperty('load-unsafe-playlists', 'yes');
          } catch (_) {}

          // Force libmpv to select the lowest bitrate variant initially (Fast-Start Optimization)
          // Removed because it prevents automatic scaling to high-resolution streams when bandwidth permits.


          // Phase 2: Fast-start — 4MB stream buffer initially (expanded after first frame)
          try {
            await (platform as dynamic).setProperty('stream-buffer-size', '4194304');
          } catch (_) {}
          // Phase 4: Smart Frame Dropping — allow strategic drops to stay near live edge
          // Prevents growing latency drift during long viewing sessions
          try {
            await (platform as dynamic).setProperty('framedrop', 'decoder+vo');
          } catch (_) {}
          // Phase 3: Strict Hardware Acceleration — mediacodec-copy for reliable
          // GPU decoding with frame copy for accurate rendering on Android
          try {
            await (platform as dynamic).setProperty('hwdec', 'mediacodec-copy');
          } catch (_) {}
          // Phase 6: Display-Synced Rendering — interpolate frames to match
          // display refresh rate (60/90/120Hz) for butter-smooth output
          try {
            await (platform as dynamic).setProperty('video-sync', 'display-resample');
          } catch (_) {}
          try {
            await (platform as dynamic).setProperty('audio-buffer', '0.5');
            // Fix for channels with no audio (like Zee Cinema):
            // 1. Force software audio decoding (libavcodec) for EAC3/AC3 to bypass device hardware codec limitations
            await (platform as dynamic).setProperty('ad', 'lavc:ac3,lavc:eac3,any');
            // 2. Downmix 5.1/7.1 to stereo (fixes EAC3 silence on many Android devices)
            await (platform as dynamic).setProperty('audio-channels', 'stereo');
            // 3. Prefer Hindi/English audio tracks if multiple exist
            await (platform as dynamic).setProperty('alang', 'hin,eng,tam,tel,mal,kan');
          } catch (_) {}
          // Deinterlace older SD IPTV channels (many Indian channels are still interlaced).
          try {
            await (platform as dynamic).setProperty('deinterlace', 'auto');
          } catch (_) {}

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

      // Backstop headers for IPTV origins that reject requests without them.
      // Web/Chrome sends these automatically; libmpv does not, so on Android
      // streams can return 403 (stuck buffering) unless we supply them.
      // Per-stream headers above take precedence for User-Agent/Referer.
      const defaultRequestHeaders = {
        'User-Agent':
            'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 '
            '(KHTML, like Gecko) NivaTV/1.2.1 Chrome/120.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
      };
      defaultRequestHeaders.forEach((k, v) {
        headers.putIfAbsent(k, () => v);
      });

      _playerDebugLog('request_headers_resolved', {
        'channel_id': _currentChannel.id,
        'header_keys': headers.keys.toList(),
        'had_user_agent': headers.containsKey('User-Agent'),
        'had_referer': headers.containsKey('Referer'),
        'had_accept': headers.containsKey('Accept'),
        'had_connection': headers.containsKey('Connection'),
      });

      // Phase 1: Zero-Copy Native Networking — bypass Dart proxy, pass headers
      // directly to libmpv's native HTTP engine for zero-GC streaming.
      // The proxy is kept as code for fallback but not used on the hot path.
      final String targetUrl = url;
      final media = Media(targetUrl, httpHeaders: headers.isNotEmpty ? headers : null);

      // Final concurrency check before we officially bind this media to the player instance
      if (_initId != myInitId) return;

      _mediaOpenCount++;
      _mediaOpenTime = DateTime.now();

      _playerDebugLog('initialize_player', {
        'channel_id': _currentChannel.id,
        'selected_stream_url': url,
        'headers': headers,
        'direct_startup_attempts': _directStartupAttempts,
        'proxy_startup_attempts': _proxyStartupAttempts,
        'runtime_recovery_attempts': _runtimeRecoveryAttempts,
        'proxy_attempted': _proxyAttempted,
        'media_open_count': _mediaOpenCount,
      });

      _playerDebugLog('source_open_requested', {
        'channel_id': _currentChannel.id,
        'media_open_count': _mediaOpenCount,
      });

      // Fix: Use open(play: true) — removes redundant play() call
      // IMPORTANT: Do NOT seek() for live stream recovery — it can jump to the beginning
      // or fail outright. Let libmpv start from the live edge via reconnect=1.
      
      await _player.open(media, play: true);
      _playerInitialized = true;

      // Enforcement safety check: ensure stream starts playing even if browser autoplay/MSE initially pauses it
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted && !_userPaused && !_recoveryInProgress && !_player.state.playing && _playbackGeneration == thisGeneration) {
          _playerDebugLog('open_auto_play_enforce', {'channel_id': _currentChannel.id});
          _player.play();
        }
      });

      // Detailed post-open diagnostics for the "stuck on buffering" investigation.
      _playerDebugLog('initialization_end', {
        'channel_id': _currentChannel.id,
        'url': url,
            'is_initialized': _playerInitialized,
        'is_loading': _isLoading,
        'is_buffering': _player.state.buffering,
        'is_playing': _player.state.playing,
        'has_error': _lastPlayerError.isNotEmpty,
        'error_description': _lastPlayerError,
        'position_ms': _player.state.position.inMilliseconds,
        'duration_ms': _player.state.duration.inMilliseconds,
        'platform': kIsWeb ? 'web' : defaultTargetPlatform.name,
      });

      _webFirstFrameTimer?.cancel();
      if (kIsWeb) {
        // On Web, hls.js reports `playing=true` before width/dimensions populate
        // for live HLS streams (MSE). Treating `playing=true` as first-frame
        // avoids the 15s startup timer tearing down a stream that is actually
        // playing. We still prefer dimensions if present (more accurate), but
        // we don't block startup on them.
        _webFirstFrameTimer = Timer.periodic(const Duration(milliseconds: 200), (timer) {
          if (!mounted || _playbackGeneration != thisGeneration || _startupCompleted) {
            timer.cancel();
            return;
          }
          if (_player.state.playing) {
            _onStartupSuccess('web_playing_first_frame', thisGeneration);
            timer.cancel();
          }
        });
      }

      _positionCheckTimer?.cancel();
      _positionCheckTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
        if (!mounted || !_playerInitialized || _playbackGeneration != thisGeneration || _recoveryInProgress) return;
        
        // Wait for startup grace to finish before enforcing position checks
        if (_sourceStartupGrace) {
          _frozenSeconds = 0;
          return;
        }

        // Only track freeze if it is playing, not buffering, and we have played before
        if (_player.state.playing && !_player.state.buffering && _playStartTime != null && !_isLoading) {
          final currentPos = _player.state.position;
          
          if (_lastPosition != null && currentPos == _lastPosition) {
            _frozenSeconds += 2;
            if (_frozenSeconds >= 10) {
              _playerDebugLog('position_frozen', {'channel_id': _currentChannel.id, 'frozen_seconds': _frozenSeconds, 'generation': thisGeneration});
              _recoverPlayback('position_frozen');
              _frozenSeconds = 0;
            }
          } else {
            // Position advanced!
            _frozenSeconds = 0;
            _lastProgressAt = DateTime.now();
          }
          _lastPosition = currentPos;
        } else {
          _frozenSeconds = 0;
        }
      });

      // -- Listen for buffering changes ----------------------------------
      _playerSubscription = _player.stream.buffering.listen((isBuffering) {
        if (!mounted || _playbackGeneration != thisGeneration) return;
        _onBufferingChanged(isBuffering);
      });

      // -- Clear the loading overlay when video starts playing --
      // On native (Android/iOS), videoParams fires exactly when the first frame is decoded.
      // On Web (Chrome MSE), videoParams is unreliable. We must use playing=true + buffering=false.
      _playerPlayingSubscription = _player.stream.playing.listen((isPlaying) {
        if (!mounted || _playbackGeneration != thisGeneration) return;
        
        if (isPlaying) {
          if (kIsWeb && !_startupCompleted) {
            _onStartupSuccess('playing_stable_web_fallback', thisGeneration);
          }
        } else if (!_userPaused && !_recoveryInProgress && _playerInitialized) {
          // Auto-resume if the stream entered a paused state automatically
          // (e.g. browser autoplay restrictions, transient buffer stall)
          // without explicit user intent.
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted && !_userPaused && !_recoveryInProgress && !_player.state.playing && _playerInitialized && _playbackGeneration == thisGeneration) {
              _playerDebugLog('auto_resume_pause_situation_fix', {'channel_id': _currentChannel.id});
              _player.play();
            }
          });
        }
      });

      _trackSubscription?.cancel();
      _trackSubscription = _player.stream.track.listen((track) {
        if (!mounted || _playbackGeneration != thisGeneration) return;
        final fps = track.video.fps;
        if (fps != null && fps > 0) {
          if (_currentVideoFps != fps) {
             _currentVideoFps = fps;
             _applyContentFrameRateMatching();
          }
        }
      });

      _playerLogSubscription?.cancel();
      _playerLogSubscription = _player.stream.log.listen((event) {
        if (!mounted || _playbackGeneration != thisGeneration) return;
        final t = event.text.toLowerCase();
        
        // Track hardware decoding and dropped frames for diagnostics
        if (t.contains('using hardware decoding')) {
           _activeVideoDecoder = 'hardware';
        } else if (t.contains('using software decoding')) {
           _activeVideoDecoder = 'software';
        }
        if (t.contains('dropped frame') || t.contains('dropping frame')) {
           _framesDropped++;
           if (_framesDropped > 100 && _activeVideoDecoder == 'software' && !_thermalSafeMode) {
             _thermalSafeMode = true;
             _displayRefreshRatePref = '60'; // Force 60Hz in thermal safe mode
             _applyUiDisplayMode();
             _playerDebugLog('thermal_safe_mode_activated', {'channel_id': _currentChannel.id});
           }
        }
        if (t.contains('delayed frame')) {
           _framesDelayed++;
        }

        if (t.contains('underrun') || t.contains('desynchronization') || t.contains('audio/video desync') || t.contains('non-monotonic dts')) {
          _playerDebugLog('audio_diagnostic', {'channel_id': _currentChannel.id, 'text': event.text});
          if (t.contains('incompatible')) {
            _recoverPlayback('android_incompatible');
          }
        }
        
        // Very basic bandwidth stall detection via libmpv logs
        if (t.contains('buffering') && t.contains('stall')) {
          _consecutiveLowBandwidthSeconds += 2;
          if (_consecutiveLowBandwidthSeconds >= 8) {
             _recoverPlayback('insufficient_bandwidth');
             _consecutiveLowBandwidthSeconds = 0;
          }
        } else if (t.contains('playing')) {
          _consecutiveLowBandwidthSeconds = 0;
        }
      });

      // Tune buffer for live fMP4 / large segments: limit readahead so it doesn't overshoot live edge
      // (media_kit Player doesn't directly expose setProperty, relying on PlayerConfiguration)

      // -- Listen for errors ---------------------------------------------
      // media_kit fires error events during normal HLS playlist resolution
      // (e.g. "Failed to open" before retrying internally). We add a small
      // grace delay so transient init errors don't trigger failure immediately.
      //
      // Fix #4: Guard with _playerErrorPending flag — media_kit can fire many error
      // events rapidly. Without this, each spawns a separate delayed failure call that
      // can race with each other and exhaust backup streams in one burst.
      _playerErrorSubscription = _player.stream.error.listen((errorMsg) {
        if (_playbackGeneration != thisGeneration) return;
        if (errorMsg.isEmpty) return;
        // Track the latest raw error for on-screen diagnostics (PlayerState has
        // no `error` field in media_kit 1.2.x — it only arrives via this stream).
        _lastPlayerError = errorMsg;
        if (!mounted) return;
        // Chrome fires "media was removed from the document" when switching channels —
        // this is a normal browser behavior, not a real playback error.
        if (errorMsg.contains('media was removed from the document') ||
            errorMsg.contains('play() request was interrupted')) {
          // Suppress known benign web errors during rapid channel switching
          return;
        }
        _playerDebugLog('player_error', {
          'channel_id': _currentChannel.id,
          'selected_stream_url': url,
          'player_error': errorMsg,
          'is_playing': _player.state.playing,
          'is_buffering': _player.state.buffering,
        });
        if (_playerErrorPending) return; // already have a pending error call — skip duplicate
        _playerErrorPending = true;
        _errorGraceTimer = Timer(const Duration(seconds: 3), () {
          _playerErrorPending = false;
          _errorGraceTimer = null;
          if (!mounted) return;
          // Act on the error if we never got to playing, or if we're currently stuck buffering.
          // Do NOT trigger failure if video is actively playing — media_kit fires routine
          // HLS-level errors (e.g. cache miss, non-fatal playlist retry) during normal playback.
          final stuckBuffering = _player.state.buffering && !_player.state.playing;
          if (!_isLoading && !stuckBuffering) return;

          // Codec / hardware-decode error: retry once with software decode (hwdec=no).
          // Some Android devices fail to hardware-decode HEVC/H.265 or exotic TS streams
          // that VLC handles via software decode. This closes the VLC vs app gap for those
          // streams without touching the fallback cascade.
          final isCodecError = _looksLikeCodecError(errorMsg);
          if (isCodecError && !_hwdecSoftwareFallbackAttempted) {
            _hwdecSoftwareFallbackAttempted = true;
            _playerDebugLog('hwdec_software_fallback', {
              'channel_id': _currentChannel.id,
              'url': url,
              'error': errorMsg,
            });
            _retryWithSoftwareDecode(url, rawHeaders);
            return;
          }

          // Mid-stream errors while buffering: do NOT restart the player here.
          // Every _recoverPlayback → _initializePlayer is a full re-open that
          // discards the entire buffered cache and re-downloads from scratch —
          // on marginal networks this created the play→stall→restart loop.
          // The stall watchdog (_bufferTimer, stallTimeoutSecs) already fires
          // for streams that are truly dead; let it be the single authority
          // for mid-stream recovery. Only act immediately when playback never
          // started at all (a real startup failure).
          if (_playStartTime != null) {
            _playerDebugLog('player_error_deferred_to_stall_watchdog', {
              'channel_id': _currentChannel.id,
              'player_error': errorMsg,
            });
            return;
          }

          _recoverPlayback('player_error');
        });
      });

      // -- Wait for actual video to be ready -----------------------------
      _videoParamsSubscription = _player.stream.videoParams
          .where((p) => p.w != null && p.w! > 0)
          .listen((params) {
        if (!mounted || params.w == null || _playbackGeneration != thisGeneration) return;
        _detectAspectRatio(paramsWidth: params.w, paramsHeight: params.h);
        _onStartupSuccess('video_params', thisGeneration);
      });

      // -- Wait for audio (Fallback for audio-only streams) --------------
      _audioParamsSubscription = _player.stream.audioParams
          .where((p) => p.channels != null && p.channels.toString().isNotEmpty)
          .listen((params) {
        if (!mounted || _playbackGeneration != thisGeneration) return;
        _onStartupSuccess('audio_params', thisGeneration);
      });



      // -- Safety startup timeout (Global dynamic budget) --------------------
      // Instead of giving each retry attempt a full 12s/15s block (which could stack up to 40s total),
      // we enforce a global channel-open budget from the moment the user tapped the channel.
      const int MAX_GLOBAL_STARTUP_SECS = 35; // Strict cap for total startup sequence
      final int elapsedSecs = _channelTapTime != null 
          ? DateTime.now().difference(_channelTapTime!).inSeconds 
          : 0;
          
      int remainingBudget = MAX_GLOBAL_STARTUP_SECS - elapsedSecs;
      
      // Minimum grace period for the *current* network attempt so we don't kill a proxy fetch instantly
      if (url.contains('/api/proxy/')) {
        if (remainingBudget < 12) remainingBudget = 12;
      } else {
        if (remainingBudget < 4) remainingBudget = 4;
      }
      
      // Calculate local ideal timeout
      int idealStartupSecs = profile.startupTimeoutSecs;
      if (isDelayedStream) idealStartupSecs = 45; // Smooth streams get their own massive budget
      else if (url.contains('/api/proxy/')) idealStartupSecs = 15;
      else if (_playbackPath == 'backup' || _playbackPath == 'transcode' || _selectedQuality != null) idealStartupSecs = 15;
      else if (_playbackPath == 'direct' && _currentChannel.healthStatus == 'unstable') idealStartupSecs = 18; // Give extra grace for unstable direct
      else if (_playbackPath == 'direct') idealStartupSecs = 12;

      // The actual timeout is whichever is smaller: the ideal local timeout, or the remaining global budget
      final int actualTimeoutSecs = isDelayedStream ? idealStartupSecs : (idealStartupSecs < remainingBudget ? idealStartupSecs : remainingBudget);

      _startupTimer = Timer(Duration(seconds: actualTimeoutSecs), () {
        if (!mounted || _playbackGeneration != thisGeneration) return;
        if (!_startupCompleted && !_hasError) {
          final hasDimensions = _player.state.width != null && _player.state.width! > 0;
          final isPlayingProgression = _player.state.playing && _player.state.position.inMilliseconds > 100;

          if (hasDimensions && isPlayingProgression) {
            _playerDebugLog('decoder_startup_delay_ignored_already_playing', {
              'channel_id': _currentChannel.id,
              'url': url,
              'position_ms': _player.state.position.inMilliseconds,
            });
            _onStartupSuccess('startup_timer_fallback', thisGeneration);
            return;
          }

          // On Web (hls.js + MSE), `playing=true` can be reported while
          // width/dimensions are still 0 and position reads 0 for live streams.
          // The width-gated first-frame listeners therefore don't fire, and we
          // must NOT kill a stream that the engine reports as actively playing —
          // regardless of proxy/direct path. Declaring init_timeout here would
          // tear down a successfully-playing channel (observed: Zee News direct
          // hit startup_timeout 15s with is_playing=true and recovered to a
          // backup that had the same false-positive).
          if (kIsWeb && _player.state.playing) {
            _playerDebugLog('decoder_startup_delay_web_playing', {
              'channel_id': _currentChannel.id,
              'url': url,
              'waited_secs': actualTimeoutSecs,
              'is_initialized': _playerInitialized,
              'is_playing': _player.state.playing,
              'is_buffering': _player.state.buffering,
              'has_dimensions': hasDimensions,
              'playback_path': _playbackPath,
            });
            _onStartupSuccess('web_playing_startup_timer', thisGeneration);
            return;
          }

          // Check for Proxy Segment Decoder Stalls (native paths)
          if (_playbackPath == 'proxy' && _player.state.playing && _player.state.buffering) {
             _playerDebugLog('decoder_startup_delay', {
                'channel_id': _currentChannel.id,
                'url': url,
                'waited_secs': actualTimeoutSecs,
                'is_initialized': _playerInitialized,
                'is_playing': _player.state.playing,
             });
             _onStartupSuccess('proxy_playing_startup_timer', thisGeneration);
             return;
          }

          _playerDebugLog('startup_timeout', {
            'channel_id': _currentChannel.id,
            'url': url,
            'waited_secs': actualTimeoutSecs,
            'elapsed_total_secs': elapsedSecs,
            'is_initialized': _playerInitialized,
            'is_buffering': _player.state.buffering,
            'is_playing': _player.state.playing,
            'has_error': _lastPlayerError.isNotEmpty,
            'error_description': _lastPlayerError,
            'platform': kIsWeb ? 'web' : defaultTargetPlatform.name,
            'direct_startup_attempts': _directStartupAttempts,
          });
          _recoverPlayback('init_timeout');
        }
      });

    } catch (e) {
      _recoverPlayback('init_failed');
    }
  }

  /// Promote to the highest native track (>=720p) shortly after playback starts.
  /// Previously this waited 60s, which caused users to see 360p for a full minute.
  /// Any buffering event cancels the pending promotion (see _onBufferingChanged).
  void _scheduleHdPromotionIfStable() {
    _hdPromoteTimer?.cancel();
    _hdPromoteTimer = null;
    if (_dataSaverEnabled) return;
    if (_hdOnlyWifi && _isOnMobileData) return;
    if (_wasQualityDowngraded || _downgradeCount > 0 || _qualityUpgradeLocked) return;

    // 15s for explicit HD pref, 25s for auto — give the stream time to prove the
    // connection is stable before pushing to a higher bitrate track.
    // 2s was too aggressive: CDN jitter in the first seconds caused immediate stalls
    // right after channel open, triggering the downgrade→lock cycle unnecessarily.
    final int delaySecs = (_defaultQualityPref == '1080p' || _defaultQualityPref == '720p') ? 15 : 25;

    _hdPromoteTimer = Timer(Duration(seconds: delaySecs), () {
      _hdPromoteTimer = null;
      if (!mounted) return;
      // Re-check stability at fire time — any stall aborts.
      if (_isLoading || _bufferingEvents.isNotEmpty || _wasQualityDowngraded ||
          _downgradeCount > 0 || _qualityUpgradeLocked) {
        return;
      }
      try {
        final nativeTracks = _player.state.tracks.video;
        if (nativeTracks.length <= 2) return;
        
        VideoTrack bestTrack;
        if (_defaultQualityPref == '720p') {
          // Try to find exactly 720p, else highest
          final t720 = nativeTracks.where((t) => t.h == 720).firstOrNull;
          bestTrack = t720 ?? nativeTracks
              .where((t) => t.id != 'auto' && t.id != 'no' && t.h != null)
              .reduce((a, b) => (a.h ?? 0) > (b.h ?? 0) ? a : b);
        } else {
          // 1080p or auto -> highest
          bestTrack = nativeTracks
              .where((t) => t.id != 'auto' && t.id != 'no' && t.h != null)
              .reduce((a, b) => (a.h ?? 0) > (b.h ?? 0) ? a : b);
        }

        final currentId = _player.state.track.video.id;
        if (bestTrack.h != null && bestTrack.h! >= 720 && bestTrack.id != currentId) {
          // Native track switch — instant, no player re-open.
          _player.setVideoTrack(bestTrack);
          // Arm the probe window: a stall soon after promotion means the
          // connection cannot sustain HD → step back down and lock.
          _upgradeProbeUntil = DateTime.now().add(const Duration(seconds: 45));
          _playerDebugLog('hd_promotion_applied', {
            'channel_id': _currentChannel.id,
            'track_height': bestTrack.h,
          });
        }
      } catch (_) {}
    });
  }

  /// Start the auto quality-upgrade timer after stable playback,
  /// only when Auto mode is active and quality was previously downgraded.
  void _startAutoUpgradeTimerIfNeeded() {
    if (!_wasQualityDowngraded) return;
    if (_qualityUpgradeLocked) return;
    // After 2 downgrades in this channel session the quality is locked —
    // repeated up/down switches are full player re-opens and were a direct
    // cause of the periodic buffering loop.
    if (_downgradeCount >= 2) return;
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
    // Arm the probe window BEFORE switching: ANY stall inside the next 45s
    // locks quality for the session (handled in _onBufferingChanged). The old
    // approach sampled _isLoading at exactly t+30s — a stall at t+40s escaped
    // the lock and the downgrade/upgrade bounce restarted.
    _upgradeProbeUntil = DateTime.now().add(const Duration(seconds: 45));
    await _autoSwitchQualityQuietly(higher, isUpgradeProbe: true);
  }

  // Fix #2: Buffering timer - only fires after sustained buffering, not on initial load.
  // When the player first opens an HLS stream it is always buffering. We only
  // treat it as a failure if buffering lasts beyond the grace period.
  void _onBufferingChanged(bool isBuffering) {
    if (isBuffering) {
      _bufferingStartTime = DateTime.now();
      // Start a buffer-stall timer only if we were already playing (not initial load).
      // For initial load the 30-second safety timeout in _initializePlayer covers us.
      final alreadyStarted = !_isLoading;
      if (alreadyStarted) {
        final now = DateTime.now();
        _bufferingEvents.add(now);
        _bufferingEvents.removeWhere((t) => now.difference(t).inSeconds > 60);

        // A stall cancels any pending HD promotion — the connection just
        // proved it can't spare headroom for a higher tier right now.
        _hdPromoteTimer?.cancel();
        _hdPromoteTimer = null;

        // Stall inside the post-upgrade probe window ⇒ the upgrade failed.
        // Lock quality for this session and step back down immediately.
        // Window-based check (vs the old one-shot t+30s sample) catches a
        // stall at ANY point after the upgrade, closing the bounce loophole.
        if (_upgradeProbeUntil != null && now.isBefore(_upgradeProbeUntil!)) {
          _upgradeProbeUntil = null;
          _qualityUpgradeLocked = true;
          _wasQualityDowngraded = false;
          _qualityUpgradeTimer?.cancel();
          _qualityUpgradeTimer = null;
          _playerDebugLog('upgrade_probe_failed_locking_quality', {
            'channel_id': _currentChannel.id,
          });
          // Prefer an instant native-track step-down (no re-open). Fall back
          // to the backend variant one step lower only if no native tracks.
          if (!_stepDownNativeTrack()) {
            final lower = _findLowerQuality();
            if (lower != null) _autoSwitchQualityQuietly(lower);
          }
        }

        // Three stalls inside a minute is strong evidence the bitrate exceeds the
        // connection capacity — adapt like YouTube.
        if (_bufferingEvents.length >= 3) {
          // Dynamic Buffer Scaling: Increase buffer window gracefully
          if (_dynamicReadaheadSecs < 120 && !kIsWeb) {
             _dynamicReadaheadSecs = (_dynamicReadaheadSecs * 1.5).ceil().clamp(0, 120);
             try {
               (_player.platform as dynamic).setProperty('demuxer-readahead-secs', '$_dynamicReadaheadSecs');
               (_player.platform as dynamic).setProperty('cache-secs', '${_dynamicReadaheadSecs * 4}');
               if (kDebugMode) debugPrint('Network stall detected. Dynamically scaling buffer to $_dynamicReadaheadSecs seconds.');
             } catch (_) {}
          }
          
          if (!_currentUrl.contains('/api/stream/transcode/')) {
            _showNetworkSlowPrompt();
            _bufferingEvents.clear();
          }
        }

        // A stall lasting 15s means the buffer fully drained — drop one quality
        // step. 7s was too aggressive: CDN hiccups (common on IPTV) often recover
        // in 5-10s on their own, and the quality switch restarts the stream causing
        // even more buffering. 15s matches what VLC-style players wait before reacting.
        _qualityStallTimer ??= Timer(const Duration(seconds: 15), () {
          _qualityStallTimer = null;
          if (!mounted || _currentUrl.contains('/api/stream/transcode/')) return;
          _tryAdaptiveDowngrade();
        });

        // Show buffering overlay after sustained buffering.
        // - If we've never received video frames yet (_playStartTime == null) → "Loading channel..."
        //   (the stream is still doing its initial HLS manifest + segment fetch)
        // - If video was actually playing before and dropped → "Reconnecting..."
        //   (a real mid-stream interruption)
        _reconnectTimer?.cancel();
        final bool hasPlayedBefore = _playStartTime != null;
        // Delay is 1s for mid-stream stalls to debounce micro-stutters.
        // For initial load, use 3s so we don't flash "Loading..." immediately if it connects fast.
        final int reconnectDelayMillis = hasPlayedBefore ? 1000 : 3000;
        _reconnectTimer = Timer(Duration(milliseconds: reconnectDelayMillis), () {
          if (mounted && alreadyStarted) {
            _playerDebugLog('showing_buffering_overlay', {
              'channel_id': _currentChannel.id,
              'current_url': _currentUrl,
              'is_buffering': _player.state.buffering,
              'has_played_before': hasPlayedBefore,
            });
            setState(() {
              _streamOverlayMessage = 'Loading...';
              _isLoading = true;
            });
          }
        });

        // Stall timeout: libmpv pauses on underrun and waits cache-pause-wait (1s mobile, 3s desktop)
        // before emitting a Flutter buffering event. The timer below is the *additional* wait
        // after that before triggering the failure cascade.
        // Mobile/Stable=40s, Fast=10s. This keeps detection under ~45s while surviving CDN hiccups.
        final stallSecs = _startupCompleted ? 40 : _activeProfile.stallTimeoutSecs;
        _bufferTimer ??= Timer(Duration(seconds: stallSecs), () {
          if (mounted) _recoverPlayback('buffer_timeout');
        });
      }
    } else {
      // RUM Telemetry calculation
      if (_bufferingStartTime != null) {
        _totalBufferingMs += DateTime.now().difference(_bufferingStartTime!).inMilliseconds;
        _bufferingStartTime = null;
      }
      // Buffering cleared - cancel stall/reconnect timers and clear loading spinner
      _bufferTimer?.cancel();
      _bufferTimer = null;
      _reconnectTimer?.cancel();
      _reconnectTimer = null;
      _qualityStallTimer?.cancel();
      _qualityStallTimer = null;
      // Start a timer for stable playback to reset retry counters.
      _stablePlaybackTimer?.cancel();
      _stablePlaybackTimer = Timer(const Duration(seconds: 30), () {
        if (mounted) {
          _directStartupAttempts = 0;
          _proxyStartupAttempts = 0;
          _runtimeRecoveryAttempts = 0;
        }
      });
      // Only clear loading here for mid-stream recovery (videoParams hasn't fired yet
      // during initial load — let videoParams handle the initial loading overlay).
      if (mounted && _isLoading && _playStartTime != null) {
        setState(() {
          _isLoading = false;
          _isRetryingStream = false;
          _streamOverlayMessage = '';
        });
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

    if (!canSwitchQuality && !canSwitchTranscode) {
      // No backend variants — the stream itself may still expose lower native
      // tracks (multi-variant HLS). Step down in place; instant, no reload.
      if (_stepDownNativeTrack()) _lastSlowWarningAt = now;
      return;
    }

    _lastSlowWarningAt = now;

    // Auto quality mode: switch silently without bothering the user
    if (_defaultQualityPref == 'auto' && canSwitchQuality) {
      _autoSwitchQualityQuietly(lowerQuality);
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

  Future<void> _autoSwitchQualityQuietly(Map<String, dynamic> quality,
      {bool isUpgradeProbe = false}) async {
    final label = quality['label'] as String? ?? 'lower quality';
    _showPlayerToast('Optimizing playback -> $label');
    setState(() {
      _selectedQuality = quality;
      _streamOverlayMessage = 'Optimizing playback...';
      _isLoading = true;
      _hasError = false;
    });
    if (!isUpgradeProbe) {
      _wasQualityDowngraded = true; // arm auto-upgrade timer + suppress force-HD
      _downgradeCount++;
      // Second downgrade in one session: the connection clearly cannot hold the
      // higher tier — lock quality to stop the re-open bounce for good.
      if (_downgradeCount >= 2) {
        _qualityUpgradeLocked = true;
        _qualityUpgradeTimer?.cancel();
        _qualityUpgradeTimer = null;
      }
    }
    _isRetryingStream = false;
    await _initializePlayer(
      quality['url'],
      quality['headers'] ?? _currentStreamMeta?['headers'] ?? {},
    );
  }

  /// ABR-style reaction to a sustained buffering stall: drop one quality step
  /// without tearing the stream down when possible. Preference order:
  /// 1. Backend quality variant one step lower (auto quality mode only)
  /// 2. Lower native video track inside the same HLS master playlist
  Future<void> _tryAdaptiveDowngrade() async {
    if (_defaultQualityPref == 'auto') {
      final lower = _findLowerQuality();
      if (lower != null) {
        await _autoSwitchQualityQuietly(lower);
        return;
      }
    }
    _stepDownNativeTrack();
  }

  /// Switches to the next lower native video track (multi-variant HLS) without
  /// reloading the stream — an instant quality drop, like YouTube's ABR.
  /// Returns true if a lower track was applied.
  bool _stepDownNativeTrack() {
    try {
      final tracks = _player.state.tracks.video
          .where((t) => t.id != 'auto' && t.id != 'no' && (t.h ?? 0) > 0)
          .toList();
      if (tracks.length < 2) return false;
      tracks.sort((a, b) => (b.h ?? 0).compareTo(a.h ?? 0)); // highest first
      final currentId = _player.state.track.video.id;
      int idx = tracks.indexWhere((t) => t.id == currentId);
      if (idx < 0) idx = 0; // 'auto' selected — treat as highest
      if (idx >= tracks.length - 1) return false; // already lowest
      final next = tracks[idx + 1];
      _player.setVideoTrack(next);
      _wasQualityDowngraded = true;
      _showPlayerToast('Optimizing playback -> ${next.h}p');
      return true;
    } catch (_) {
      return false;
    }
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

  Future<void> _recoverPlayback(String reason) async {
    if (_recoveryInProgress) return;
    _recoveryInProgress = true;
    
    // Phase 7: Gentle Recovery — for network hiccups (buffer_timeout,
    // position_frozen), try pause/resume first to let libmpv's built-in
    // reconnect recover without destroying the entire download cache.
    final isNetworkHiccup = (reason == 'buffer_timeout' || reason == 'position_frozen');
    if (isNetworkHiccup && _gentleRecoveryAttempts < 2 && _playStartTime != null) {
      _gentleRecoveryAttempts++;
      _playerDebugLog('gentle_recovery_attempt', {
        'channel_id': _currentChannel.id,
        'reason': reason,
        'attempt': _gentleRecoveryAttempts,
      });
      try {
        // Pause + unpause forces libmpv to retry the current segment
        // without discarding the buffer cache
        await _player.pause();
        await Future.delayed(const Duration(seconds: 2));
        if (!mounted) { _recoveryInProgress = false; return; }
        await _player.play();
      } catch (_) {}
      _recoveryInProgress = false;
      return;
    }
    
    // Full recovery path — reset gentle counter
    _gentleRecoveryAttempts = 0;
    
    // Stop playback immediately to avoid background audio or stuck frames
    try { await _player.pause(); } catch (_) {}
    
    _playerDebugLog('stream_failure', {
      'channel_id': _currentChannel.id,
      'reason': reason,
      'direct_startup_attempts': _directStartupAttempts,
      'proxy_startup_attempts': _proxyStartupAttempts,
      'runtime_recovery_attempts': _runtimeRecoveryAttempts,
      'current_url': _currentUrl,
      'proxy_attempted': _proxyAttempted,
      'is_playing': _player.state.playing,
      'is_buffering': _player.state.buffering,
      'generation': _playbackGeneration,
    });
    if (_isRetryingStream) {
      _recoveryInProgress = false;
      return;
    }

    if (_pendingSmoothUrl != null && !_switchedToSmooth) {
      final smoothUrl = _pendingSmoothUrl!;
      _pendingSmoothUrl = null;
      _switchedToSmooth = true;
      _playbackPath = 'smooth';
      if (mounted) setState(() { _streamOverlayMessage = 'Loading...'; _isLoading = true; _hasError = false; });
      await _initializePlayer(smoothUrl, {});
      return;
    }
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _startupTimer?.cancel();
    _startupTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    
    // Fix A: Silent retries before fallback cascade
    if (_silentRetryCount < 2 && !_directFailed && _playbackPath == 'direct') {
      _silentRetryCount++;
      final delayMs = _silentRetryCount == 1 ? 1500 : 3000;
      if (mounted) setState(() { 
        _streamOverlayMessage = 'Reconnecting...'; 
        _isLoading = true; 
        _hasError = false; 
      });
      
      if (_silentRetryCount == 1 && _currentUrl != null) {
        // First retry: just wait and reopen the same URL
        await Future.delayed(Duration(milliseconds: delayMs));
        if (!mounted || _recoveryInProgress == false) return;
        _isRetryingStream = false;
        _hadFailureBeforePlaying = true;
        await _initializePlayer(_currentUrl!, _currentStreamMeta?['headers'] ?? {});
        return;
      } else {
        // Second retry: wait and re-fetch from API to see if URL changed
        await Future.delayed(Duration(milliseconds: delayMs));
        if (!mounted || _recoveryInProgress == false) return;
        // Proceed down to the API fetch block without setting _directFailed = true
      }
    }

    if (!_directFailed && _playbackPath != 'proxy') {
      if (_silentRetryCount >= 2) _directFailed = true; // Mark failed after silent retries
      _directStartupAttempts++;
      if (mounted) setState(() { _streamOverlayMessage = 'Trying backup source...'; _isLoading = true; _hasError = false; });
      try {
        final res = await _api.get(ApiEndpoints.channelPlaybackPath(_currentChannel.id));
        if (res['success'] == true) {
          final data = res['data'];
          final newPrimary = data['primary_stream'];
          
          if (newPrimary != null) {
            final newUrl = newPrimary['url'] ?? newPrimary['final_url'] ?? newPrimary['stream_url'];
            final newId = newPrimary['id']?.toString() ?? '';
            final oldId = _currentStreamMeta?['id']?.toString() ?? '';
            
            String normalizeUrl(String u) => u.replaceAll(RegExp(r'(&|\?)token=[^&]+'), '');
            final bool urlChanged = newUrl != null && normalizeUrl(newUrl) != normalizeUrl(_currentUrl);
            final bool idChanged = newId.isNotEmpty && oldId.isNotEmpty && newId != oldId;

            if (urlChanged || idChanged) {
              _currentStreamMeta = newPrimary;
              _backupStreams = List<dynamic>.from(data['backup_streams'] ?? []);
              _qualities = List<dynamic>.from(data['qualities'] ?? []);
              _proxyUrl = data['proxy_url'] as String?;
              _isRetryingStream = false;
              
              final headersToUse = newPrimary['headers'] ?? {};
              await _initializePlayer(newUrl!, headersToUse);
              return;
            } else {
              _playerDebugLog('same_source_rejected', {'url': _currentUrl});
              _backupStreams = List<dynamic>.from(data['backup_streams'] ?? []);
              _qualities = List<dynamic>.from(data['qualities'] ?? []);
            }
          }
        }
      } catch (e) {
        // ignore and fall through
      }
    } else if (_playbackPath == 'proxy') {
      // proxy startup attempts are now tracked when the path is selected
    } else {
      _runtimeRecoveryAttempts++;
    }

    _isRetryingStream = true;
    _hadFailureBeforePlaying = true; 

    try {
      await _api.post(ApiEndpoints.channelReportFailurePath(_currentChannel.id), {
        'reason': reason,
        'stream_url': _currentUrl,
        'stream_id': _currentStreamMeta?['id'],
        'playback_path': _playbackPath,
        'failureCode': reason,
        'activeState': _player.state.playing ? 'playing' : 'stalled',
        'generation': _playbackGeneration,
      });
    } catch(e) {}

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
        if (mounted) setState(() { _streamOverlayMessage = 'Optimizing playback...'; _isLoading = true; _hasError = false; });
        _selectedQuality = lowerQuality;
        _wasQualityDowngraded = true;
        _isRetryingStream = false;
        _playbackPath = 'direct';
        await _initializePlayer(lowerQuality['url'], lowerQuality['headers'] ?? _currentStreamMeta?['headers'] ?? {});
        _showPlayerToast('Switched to $lowerLabel for smoother playback');
        return;
      }

      if (_isPremium && !_currentUrl.contains('/api/stream/transcode/')) {
        if (mounted) setState(() { _streamOverlayMessage = 'Connecting to a better source...'; _isLoading = true; _hasError = false; });
        _isRetryingStream = false;
        try {
          final token = await StorageService().getToken() ?? '';
          if (token.isEmpty) throw Exception('No token');
          final fallbackUrl = '${BackendConfig.baseUrl}${ApiEndpoints.streamTranscodePath(_currentChannel.id, quality: '360')}';
          final transcodeHeaders = {'Authorization': 'Bearer $token'};
          _currentStreamMeta = {'url': fallbackUrl, 'headers': transcodeHeaders};
          _playbackPath = 'transcode';
          await _initializePlayer(fallbackUrl, transcodeHeaders);
          return;
        } catch (e) {
          if (mounted) setState(() { _isLoading = false; _streamOverlayMessage = ''; });
        }
      }
    }

    if (_backupStreams.isNotEmpty && !_proxyStarted) {
      if (mounted) setState(() { _streamOverlayMessage = 'Connecting to a better source...'; _isLoading = true; _hasError = false; });
      final backup = _backupStreams.removeAt(0);
      _currentStreamMeta = backup;
      _isRetryingStream = false;
      _playbackPath = 'backup';
      await _initializePlayer(backup['url'], backup['headers']);
      return;
    }

    if (!_proxyAttempted && _proxyUrl != null) {
      _proxyAttempted = true;
      _proxyStartupAttempts++;
      _proxyStarted = true;
      _isRetryingStream = false;
      if (mounted) setState(() {
        _streamOverlayMessage = 'Connecting to a better source...';
        _isLoading = true;
        _hasError = false;
      });
        final proxyHeaders = <String, String>{};
        if (!kIsWeb) {
          final prefs = await SharedPreferences.getInstance();
          final token = prefs.getString(StorageKeys.token);
          if (token != null) {
             proxyHeaders['Authorization'] = 'Bearer $token';
          }
        }
        _proxyHeaders = proxyHeaders;
        _playbackPath = 'proxy';
        await _initializePlayer(_proxyUrl!, proxyHeaders);
        return;
      }

    if (mounted) {
      _lastErrorReason = reason;
      _lastErrorDescription = _lastPlayerError.isNotEmpty
          ? _lastPlayerError
          : 'Playback could not start. The stream may be offline, require a '
              'specific User-Agent/Referer, or use a codec/container unsupported '
              'on Android.';
      setState(() { _isLoading = false; _hasError = true; _streamOverlayMessage = ''; });
      _startAutoRetryTimer();
    }
    _recoveryInProgress = false;
  }


  /// Reports successful playback to backend.
  /// Only called after the first real frame is rendered (_onStartupSuccess).
  /// Captures the channel/stream state at call time to prevent stale reports
  /// if the user switches channel while the API call is in flight.
  Future<void> _reportPlaybackSuccess() async {
    if (_hasReportedPlaybackSuccessForSession == _channelSessionId) return;
    _hasReportedPlaybackSuccessForSession = _channelSessionId;
    
    // Capture everything synchronously before any await
    final int mySession = _channelSessionId;
    final int channelId = _currentChannel.id;
    final String result = _hadFailureBeforePlaying ? 'played_after_retry' : 'played';
    final int bufferSeconds = _playStartTime != null
        ? DateTime.now().difference(_playStartTime!).inSeconds
        : 0;
    final String? streamUrl = _currentUrl;
    final dynamic streamId = _currentStreamMeta?['id'];
    final String path = _playbackPath;
    try {
      await _api.post(ApiEndpoints.channelPlaybackResultPath(channelId), {
        'result': result,
        'status': _hadFailureBeforePlaying ? 'unstable' : 'online',
        'stream_url': streamUrl,
        'stream_id': streamId,
        'buffer_seconds': bufferSeconds,
        'playback_path': path,
      });
      // Silently drop if user has already switched — do not log a success for old channel
      if (_channelSessionId != mySession) {
        _playerDebugLog('stale_callback_ignored', {
          'reason': 'report_playback_success_stale',
          'reported_channel': channelId,
        });
      }
    } catch (_) {}
  }

  // ---- Data Loading ----

  Future<void> _loadChannelData() async {
    final channelId = _currentChannel.id;
    final int mySession = _channelSessionId; // Capture session ID at call time
    
    if (mounted) setState(() { _loadingEPG = true; _loadingRelated = true; });

    // EPG Now Playing
    try {
      final nowRes = await _api.get(ApiEndpoints.channelEPGNowPath(channelId));
      // Drop response if the user already switched to a different channel
      if (!mounted || _channelSessionId != mySession) return;
      if (nowRes['success'] == true && nowRes['data'] != null) {
        _nowPlaying = EpgProgram.fromJson(nowRes['data']);
      }
    } catch (_) {
      _nowPlaying = null;
    }
    if (!mounted || _channelSessionId != mySession) return;

    // Upcoming EPG
    try {
      final upcomingRes = await _api.get(ApiEndpoints.channelEPGUpcomingPath(channelId));
      if (!mounted || _channelSessionId != mySession) return;
      if (upcomingRes['success'] == true && upcomingRes['data'] != null) {
        final rawUpcoming = upcomingRes['data'];
        if (rawUpcoming is List) {
          _upcoming = rawUpcoming.map((p) => EpgProgram.fromJson(p)).toList();
        }
      }
    } catch (_) {
      _upcoming = [];
    }
    if (!mounted || _channelSessionId != mySession) return;

    if (mounted) setState(() { _loadingEPG = false; });

    // Related Channels
    try {
      final relatedRes = await _api.get(ApiEndpoints.channelRelatedPath(channelId));
      if (!mounted || _channelSessionId != mySession) return;
      if (relatedRes['success'] == true && relatedRes['data'] != null) {
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
    if (!mounted || _channelSessionId != mySession) return;

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
    // ── Step 1: Invalidate the previous channel session IMMEDIATELY ─────────────
    // Every in-flight async operation (API calls, player events, timers) checks
    // _channelSessionId. By incrementing it here, all stale callbacks from the
    // previous channel become no-ops the instant they resume after their await.
    _channelSessionId++;
    _channelTapTime = DateTime.now(); // Reset global startup budget for the new channel

    _playerDebugLog('channel_switch_requested', {
      'new_channel_id': _currentChannel.id,
      'new_channel_name': _currentChannel.name,
      'new_session_id': _channelSessionId,
    });

    // ── Step 2: Stop the previous player stream synchronously ───────────────────
    // This MUST happen before _fetchPlaybackAndInitialize to ensure libmpv stops
    // requesting HLS playlists and segments for the previous channel. Without this,
    // old streams continue downloading in the background after channel switch.
    _isStoppingPrevious = true;
    _player.stop().catchError((_) {}).then((_) {
      _isStoppingPrevious = false;
    });

    // Cancel all timers and subscriptions from the old session immediately
    _bufferTimer?.cancel(); _bufferTimer = null;
    _startupTimer?.cancel(); _startupTimer = null;
    _playerSubscription?.cancel(); _playerSubscription = null;
    _playerErrorSubscription?.cancel(); _playerErrorSubscription = null;
    _videoParamsSubscription?.cancel(); _videoParamsSubscription = null;
    _audioParamsSubscription?.cancel(); _audioParamsSubscription = null;
    _playerPlayingSubscription?.cancel(); _playerPlayingSubscription = null;
    _positionCheckTimer?.cancel(); _positionCheckTimer = null;
    _errorGraceTimer?.cancel(); _errorGraceTimer = null;
    _playerErrorPending = false;
    _qualityUpgradeTimer?.cancel(); _qualityUpgradeTimer = null;
    _smoothWarmTimer?.cancel(); _smoothWarmTimer = null;
    _gapWarningRefreshTimer?.cancel(); _gapWarningRefreshTimer = null;

    _playerDebugLog('old_session_cancelled', {
      'channel_id': _currentChannel.id,
      'session_id': _channelSessionId,
    });

    _hadFailureBeforePlaying = false;
    _directStartupAttempts = 0;
    _proxyStartupAttempts = 0;
    _runtimeRecoveryAttempts = 0;
    _directFailed = false;
    _proxyStarted = false;
    _silentRetryCount = 0;
    _autoRetryTimer?.cancel();
    _autoRetryTimer = null;
    _autoRetryCountdown = 0;
    _autoRetryAttempts = 0;
    _lastApiHeaders = null;
    _hwdecSoftwareFallbackAttempted = false;
    // Reset smooth playback state for new channel
    _smoothPlaybackEnabled = false;
    _bufferReady = false;
    _delaySeconds = 0;
    _requiredDelaySeconds = 0;
    _bufferDepthSeconds = 0;
    _bufferStatus = '';
    _directLiveUrl = null;
    _canGoLive = false;
    _showPreparingOverlay = false;
    _switchedToSmooth = false;
    _pendingSmoothUrl = null;
    _warmStartedAt = null;
    _gapWarning = false;
    _gapWarningMessage = '';
    _bufferQualityStatus = 'clean_buffer';
    _cleanBufferPercentage = 100;
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
    
    // Save to local watch history
    StorageService().saveWatchHistory(_currentChannel);
    
    // ── Phase 1: Start video playback (top priority) ─────────────────────────────
    _fetchPlaybackAndInitialize();
    
    // ── Phase 2: Secondary API calls deferred — called from _onStartupSuccess ───
    // EPG, related channels, etc. will load after the first frame renders.
    // _loadChannelData() is intentionally NOT called here.

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
        // Intentionally contain, NOT cover/fill: the fill effect is a bounded
        // scale transform on top of contain (see _getTransformScale /
        // _safeFillScale) so cropping stays capped at 4-8% per side.
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
    if (!_isFullScreen) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
    } else {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
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
    _stopHeartbeatTimer();
    _hudTimer?.cancel();
    _lockHudTimer?.cancel();
    _sleepTimer?.cancel();
    _bufferTimer?.cancel();
    _startupTimer?.cancel();
    _reconnectTimer?.cancel();
    _qualityStallTimer?.cancel();
    _controlsTimer?.cancel();
    _slowOverlayTimer?.cancel();
    _playerToastTimer?.cancel();
    _livePulseTimer?.cancel();
    _qualityUpgradeTimer?.cancel();
    _gapWarningRefreshTimer?.cancel();
    _smoothWarmTimer?.cancel();
    _stablePlaybackTimer?.cancel();
    _audioParamsSubscription?.cancel();
    _playerPlayingSubscription?.cancel();
    _playerLogSubscription?.cancel();
    _positionCheckTimer?.cancel();
    _errorGraceTimer?.cancel();
    _hdPromoteTimer?.cancel();
    _playerSubscription?.cancel();
    _playerErrorSubscription?.cancel();
    _videoParamsSubscription?.cancel();
    _playerPlayingSubscription?.cancel();
    // Fix #4: Cancel error grace timer on dispose to prevent post-dispose callbacks
    _errorGraceTimer?.cancel();
    if (!kIsWeb) {
      _player.dispose();
    } else {
      _player.stop();
    }
    _controlsAnimController.dispose();
    _scrollController.dispose();
    
    // RUM Telemetry Report
    if (_totalBufferingMs > 0 && _mediaOpenCount > 0) {
       if (kDebugMode) debugPrint('[RUM] Channel ${_currentChannel.id} experienced ${_totalBufferingMs}ms of buffering over $_mediaOpenCount sessions.');
    }
    
    _hlsProxy.stop();
    // Fix #9: Disable wakelock when leaving player
    WakelockPlus.disable();
    if (_isFullScreen) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    
    // Ensure the home screen snaps back to max 90/120Hz when leaving the player
    if (Platform.isAndroid) {
      try {
        FlutterDisplayMode.setHighRefreshRate();
      } catch (_) {}
    }
    super.dispose();
  }

  // =====================================================================
  // BUILD
  // =====================================================================

  Widget build(BuildContext context) {
    if (widget.isMinimized || widget.isOsPipMode) {
      // In minimized or OS PiP mode, just return the video surface without scaffolding/controls
      return Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(child: _buildVideoSurface()),
          if (_isLoading) Positioned.fill(child: _buildLoadingOverlay()),
          if (_hasError) Positioned.fill(child: _buildErrorOverlay()),
        ],
      );
    }

    return OrientationBuilder(
      builder: (context, orientation) {
        final isLandscape = orientation == Orientation.landscape;
        
        if (isLandscape && !_isFullScreen) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              setState(() { _isFullScreen = true; });
              SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
              _applyContentFrameRateMatching();
            }
          });
        } else if (!isLandscape && _isFullScreen) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              setState(() { _isFullScreen = false; });
              SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
              _applyContentFrameRateMatching();
              
              Future.delayed(const Duration(milliseconds: 500), () {
                if (mounted && !_isFullScreen) {
                  SystemChrome.setPreferredOrientations([
                    DeviceOrientation.portraitUp,
                    DeviceOrientation.portraitDown,
                    DeviceOrientation.landscapeLeft,
                    DeviceOrientation.landscapeRight,
                  ]);
                }
              });
            }
          });
        }

        // When not minimized, intercept back button to minimize instead of popping underlying route.
        // When minimized, let the app handle back button normally.
        return PopScope(
          canPop: widget.isMinimized && !_isFullScreen,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            if (_isFullScreen) {
              _toggleFullScreen();
            } else if (!widget.isMinimized) {
              // Minimize instead of popping
              context.read<MiniPlayerCubit>().minimize();
            }
          },
          child: Scaffold(
            backgroundColor: Colors.black,
            body: _isFullScreen
                ? _buildFullscreen()
                : SafeArea(child: _buildPortrait()),
          ),
        );
      },
    );
  }

  // ---- Fullscreen ----

  Widget _buildFullscreen() {
    return _buildGestureDetector(
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Video fills the entire screen
          Positioned.fill(child: _buildVideoSurface()),
          // Software Brightness Dimming Layer
          if (_brightness < 1.0)
            Positioned.fill(
              child: IgnorePointer(
                child: Container(
                  color: Colors.black.withOpacity((1.0 - _brightness) * 0.85),
                ),
              ),
            ),
          if (_isLoading) Positioned.fill(child: _buildLoadingOverlay()),
          if (_hasError) Positioned.fill(child: _buildErrorOverlay()),
          if (_warmingOverLive)
            Positioned(top: 0, left: 0, right: 0, child: _buildWarmingBanner()),
          
          // Controls / Locked Overlay
          if (_isLocked)
            _buildLockedOverlay()
          else
            Positioned.fill(
              child: FadeTransition(
                opacity: _controlsOpacity,
                child: IgnorePointer(
                  ignoring: !_showControls,
                  child: _buildControlsOverlay(fullscreen: true),
                ),
              ),
            ),
          
          // HUD Overlays
          if (_showBrightnessHud) _buildBrightnessHud(),
          if (_showVolumeHud) _buildVolumeHud(),
          if (_isSpeedBoosted) _buildSpeedBoostHud(),
          _buildSlowConnectionOverlay(),
          _buildPlayerToast(),
          if (_showDebugDiagnostics)
             Positioned(
               top: 20, right: 20,
               child: _buildDiagnosticOverlay(),
             ),
        ],
      ),
    );
  }

  // ---- Portrait ----

  Widget _buildPortrait() {
    return Column(
      children: [
        Flexible(
          flex: 0,
          fit: FlexFit.loose,
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              color: Colors.black,
              child: _buildGestureDetector(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildVideoSurface(),
                    // Software Brightness Dimming Layer
                    if (_brightness < 1.0)
                      Positioned.fill(
                        child: IgnorePointer(
                          child: Container(
                            color: Colors.black.withOpacity((1.0 - _brightness) * 0.85),
                          ),
                        ),
                      ),
                    if (_isLoading) Positioned.fill(child: _buildLoadingOverlay()),
                    if (_hasError) Positioned.fill(child: _buildErrorOverlay()),
                    if (_warmingOverLive)
                      Positioned(top: 0, left: 0, right: 0, child: _buildWarmingBanner()),
                    if (_gapWarning && !_isLoading && !_hasError)
                      Positioned(top: 0, left: 0, right: 0, child: _buildGapWarningBanner()),
                    
                    // Controls / Locked Overlay
                    if (_isLocked)
                      _buildLockedOverlay()
                    else if (!_hasError && !_isLoading)
                      Positioned.fill(
                        child: FadeTransition(
                          opacity: _controlsOpacity,
                          child: IgnorePointer(
                            ignoring: !_showControls,
                            child: _buildControlsOverlay(),
                          ),
                        ),
                      ),
                    
                    // HUD Overlays
                    if (_showBrightnessHud) _buildBrightnessHud(),
                    if (_showVolumeHud) _buildVolumeHud(),
                    if (_isSpeedBoosted) _buildSpeedBoostHud(),
                    _buildSlowConnectionOverlay(),
                    _buildPlayerToast(),
                    if (_showDebugDiagnostics)
                       Positioned(
                         top: 10, right: 10,
                         child: _buildDiagnosticOverlay(),
                       ),
                  ],
                ),
              ),
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
            filterQuality: FilterQuality.medium,
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
              // While a direct/live stream can play, warming shows as a small banner over the
              // video (see _buildWarmingBanner), NOT a full-screen "Preparing" spinner. The
              // preparing spinner + Play Direct Live button only appears when there is no
              // playable direct stream (cold source) or a terminal/timeout state.
              if (_showPreparingOverlay && !_hasPlayableDirectStream) ...[
                const SizedBox(height: 16),
                const Text('Preparing smooth playback...', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text(_warmingProgressText(), style: const TextStyle(color: Colors.white38, fontSize: 11)),
                if (_canGoLive && _directLiveUrl != null && _directLiveUrl!.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: _goLiveFromWarming,
                    icon: const Icon(Icons.play_arrow_rounded, size: 16),
                    label: const Text('Play Direct Live'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(AppColors.primary),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      minimumSize: const Size(0, 32),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],
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

  /// Skip-missing-chunks gap warning banner. Shown when the backend reports
  /// moderate/severe buffer gaps so the viewer knows playback continues but
  /// the source is unstable (not a player bug).
  Widget _buildGapWarningBanner() {
    final Color borderColor = _bufferQualityStatus == 'severe_gaps'
        ? const Color(0xFFE53935)
        : const Color(0xFFFFA726);
    final String message = _gapWarningMessage.isNotEmpty
        ? _gapWarningMessage
        : 'Channel source is unstable. Playback may skip briefly.';
    return SafeArea(
      bottom: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 6, 10, 0),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.66),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: borderColor, width: 1),
        ),
        child: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: borderColor, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w600),
              ),
            ),
            if (_cleanBufferPercentage < 100) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: borderColor.withOpacity(0.22),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '$_cleanBufferPercentage%',
                  style: TextStyle(color: borderColor, fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildErrorOverlay() {
    // Show a short, human-readable cause derived from the failure reason/description.
    String causeSummary;
    final desc = _lastErrorDescription.toLowerCase();
    if (_lastErrorReason == 'init_timeout' || _lastErrorReason == 'buffer_timeout') {
      causeSummary = 'Playback did not start within the time limit (timeout).';
    } else if (desc.contains('tls') || desc.contains('ssl') || desc.contains('certificate')) {
      causeSummary = 'Secure connection (HTTPS/TLS) failed on this device.';
    } else if (desc.contains('403') || desc.contains('401') || desc.contains('forbidden')) {
      causeSummary = 'Stream rejected the request (auth/headers: 403/401).';
    } else if (desc.contains('codec') || desc.contains('decoder') || desc.contains('unsupported')) {
      causeSummary = 'Unsupported codec/container for Android.';
    } else if (desc.contains('404') || desc.contains('not found')) {
      causeSummary = 'Stream source returned 404 (not found).';
    } else if (_lastErrorDescription.isNotEmpty) {
      causeSummary = _lastErrorDescription;
    } else {
      causeSummary = 'No stable source is available right now.';
    }

    final recentLogs = _globalDiagLog.reversed.take(18).toList().reversed.toList();

    return Container(
      color: Colors.black,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
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
                if (_autoRetryCountdown > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Retrying in $_autoRetryCountdown' + 's...',
                      style: const TextStyle(color: Colors.blueAccent, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        causeSummary,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        textAlign: TextAlign.left,
                      ),
                      const SizedBox(height: 8),
                      _diagRow('Reason', _lastErrorReason.isNotEmpty ? _lastErrorReason : 'unknown'),
                      _diagRow('Path', _playbackPath),
                      _diagRow('Platform', kIsWeb ? 'web' : defaultTargetPlatform.name),
                      _diagRow('Stream', _currentUrl),
                      if (_lastErrorDescription.isNotEmpty)
                        _diagRow('Player error', _lastErrorDescription),
                    ],
                  ),
                ),
                // Collapsible recent on-screen diagnostic log (Option C: no PC needed)
                TextButton(
                  onPressed: () => setState(() => _showDiagDetails = !_showDiagDetails),
                  child: Text(
                    _showDiagDetails ? 'Hide diagnostics' : 'Show diagnostics (last logs)',
                    style: const TextStyle(color: Colors.blueAccent, fontSize: 12),
                  ),
                ),
                if (_showDiagDetails)
                  Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxHeight: 220),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: SingleChildScrollView(
                      child: SelectableText(
                        recentLogs.join('\n'),
                        style: const TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 10,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                if (_showDiagDetails)
                  TextButton.icon(
                    onPressed: () {
                      final buf = StringBuffer();
                      buf.writeln('Channel: ${_currentChannel.name} (id=${_currentChannel.id})');
                      buf.writeln('Reason: $_lastErrorReason');
                      buf.writeln('Path: $_playbackPath');
                      buf.writeln('Platform: ${kIsWeb ? 'web' : defaultTargetPlatform.name}');
                      buf.writeln('Stream: $_currentUrl');
                      buf.writeln('Player error: $_lastErrorDescription');
                      buf.writeln('--- recent diagnostics ---');
                      buf.writeln(recentLogs.join('\n'));
                      Share.share(buf.toString(), subject: 'NivaTV playback diagnostics');
                    },
                    icon: const Icon(Icons.share, size: 14, color: Colors.blueAccent),
                    label: const Text('Share diagnostics', style: TextStyle(color: Colors.blueAccent, fontSize: 12)),
                  ),
                const SizedBox(height: 16),
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
      ),
    );
  }

  Widget _diagRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 92,
            child: Text(
              '$label:',
              style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: SelectableText(
              value,
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  /// Small translucent banner shown over the live/direct video while the smooth buffer is
  /// warming. Shows buffer progress and a prominent "Watch Live" escape button immediately
  /// so users never feel trapped waiting for the buffer.
  Widget _buildWarmingBanner() {
    final isUnstable = _bufferStatus == 'source_timeout' ||
        _bufferStatus == 'trying_backup' ||
        _bufferStatus == 'backup_active' ||
        _bufferStatus == 'no_working_source' ||
        _bufferStatus == 'warm_timeout';
    final Color accentColor = isUnstable
        ? const Color(0xFFFFA726)
        : const Color(0xFF42A5F5);
    final delay = (_requiredDelaySeconds > 0 ? _requiredDelaySeconds : _delaySeconds).clamp(1, 9999);
    final depth = _bufferDepthSeconds.clamp(0, delay);
    final bufferProgress = depth / delay;

    return SafeArea(
      bottom: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 6, 10, 0),
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.72),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: accentColor, width: 1),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(isUnstable ? Icons.warning_amber_rounded : Icons.slow_motion_video_rounded,
                    color: accentColor, size: 16),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _warmingProgressText(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w600),
                  ),
                ),
                // "Watch Live" button always visible from second 1
                if (_canGoLive && _directLiveUrl != null && _directLiveUrl!.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _goLiveFromWarming,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                      decoration: BoxDecoration(
                        color: accentColor,
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.live_tv_rounded, color: Colors.white, size: 12),
                          SizedBox(width: 4),
                          Text('Watch Live',
                              style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
            // Buffer progress bar (only shown when buffer is actively building)
            if (!isUnstable && delay > 0) ...[
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: bufferProgress,
                  backgroundColor: Colors.white12,
                  valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                  minHeight: 3,
                ),
              ),
            ],
          ],
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

  Widget _buildGestureDetector({required Widget child}) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (_isLocked) {
          _showLockNotice();
          return;
        }
        _toggleControls();
      },
      onDoubleTapDown: (details) {
        if (_isLocked) return;
        final screenWidth = MediaQuery.of(context).size.width;
        final x = details.globalPosition.dx;
        if (x < screenWidth * 0.35) {
          _playPreviousChannel();
          _showPlayerToast('⏮ Previous Channel');
        } else if (x > screenWidth * 0.65) {
          _playNextChannel();
          _showPlayerToast('⏭ Next Channel');
        } else {
          _userPaused = _player.state.playing;
          _player.playOrPause();
          _showControlsWithTimer();
        }
      },
      onVerticalDragUpdate: (details) {
        if (_isLocked) return;
        final screenWidth = MediaQuery.of(context).size.width;
        final x = details.globalPosition.dx;
        final delta = -details.primaryDelta! / 200.0;
        if (x < screenWidth * 0.5) {
          _adjustBrightness(delta);
        } else {
          _adjustVolume(delta * 100);
        }
      },
      onLongPressStart: (_) {
        if (_isLocked) return;
        _enableSpeedBoost(true);
      },
      onLongPressEnd: (_) {
        if (_isLocked) return;
        _enableSpeedBoost(false);
      },
      child: child,
    );
  }

  void _adjustBrightness(double delta) {
    setState(() {
      _brightness = (_brightness + delta).clamp(0.15, 1.0);
      _showBrightnessHud = true;
      _showVolumeHud = false;
    });
    _hudTimer?.cancel();
    _hudTimer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() { _showBrightnessHud = false; });
    });
  }

  void _adjustVolume(double delta) {
    final currentVol = _player.state.volume;
    final newVol = (currentVol + delta).clamp(0.0, 100.0);
    _player.setVolume(newVol);
    setState(() {
      _volume = newVol;
      _showVolumeHud = true;
      _showBrightnessHud = false;
    });
    _hudTimer?.cancel();
    _hudTimer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() { _showVolumeHud = false; });
    });
  }

  void _enableSpeedBoost(bool enable) {
    if (enable) {
      _player.setRate(1.5);
      setState(() { _isSpeedBoosted = true; });
      HapticFeedback.selectionClick();
    } else {
      _player.setRate(1.0);
      setState(() { _isSpeedBoosted = false; });
    }
  }

  void _showLockNotice() {
    _lockHudTimer?.cancel();
    setState(() { _showLockHud = true; });
    _lockHudTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() { _showLockHud = false; });
    });
  }

  Widget _buildLockedOverlay() {
    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _showLockNotice,
        child: AnimatedOpacity(
          opacity: _showLockHud ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 250),
          child: Container(
            color: Colors.black45,
            child: Center(
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    _isLocked = false;
                    _showLockHud = false;
                  });
                  _showPlayerToast('🔓 Screen Unlocked');
                  _showControlsWithTimer();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                  decoration: BoxDecoration(
                    color: const Color(AppColors.surface).withOpacity(0.95),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: Colors.amberAccent.withOpacity(0.6), width: 1.2),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.6), blurRadius: 24, spreadRadius: 2),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.lock_rounded, color: Colors.amberAccent, size: 20),
                      SizedBox(width: 10),
                      Text(
                        'Locked • Tap to Unlock',
                        style: TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w700, letterSpacing: 0.2),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBrightnessHud() {
    return Positioned(
      left: 20,
      top: 0,
      bottom: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.8),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white24, width: 0.8),
            boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 16)],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _brightness > 0.6 ? Icons.brightness_7_rounded : (_brightness > 0.3 ? Icons.brightness_6_rounded : Icons.brightness_4_rounded),
                color: const Color(AppColors.primary),
                size: 22,
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 100,
                width: 5,
                child: RotatedBox(
                  quarterTurns: 3,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2.5),
                    child: LinearProgressIndicator(
                      value: _brightness,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(AppColors.primary)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text('${(_brightness * 100).toInt()}%', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVolumeHud() {
    return Positioned(
      right: 20,
      top: 0,
      bottom: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.8),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white24, width: 0.8),
            boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 16)],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _volume == 0 ? Icons.volume_off_rounded : (_volume < 50 ? Icons.volume_down_rounded : Icons.volume_up_rounded),
                color: const Color(AppColors.primary),
                size: 22,
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 100,
                width: 5,
                child: RotatedBox(
                  quarterTurns: 3,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2.5),
                    child: LinearProgressIndicator(
                      value: _volume / 100.0,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(AppColors.primary)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text('${_volume.toInt()}%', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpeedBoostHud() {
    return Positioned(
      top: 24,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.85),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(AppColors.primary).withOpacity(0.6)),
            boxShadow: [BoxShadow(color: const Color(AppColors.primary).withOpacity(0.3), blurRadius: 12)],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.fast_forward_rounded, color: Color(AppColors.primary), size: 18),
              SizedBox(width: 6),
              Text('1.5X SPEED', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
            ],
          ),
        ),
      ),
    );
  }

  void _showSleepTimerSelector() {
    _controlsTimer?.cancel();
    final options = [0, 15, 30, 45, 60, 90, 120];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: const Color(AppColors.surface).withOpacity(0.98),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: Colors.white.withOpacity(0.12), width: 1)),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 12),
                Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
                const SizedBox(height: 20),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Sleep Timer', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 12),
                ...options.map((mins) {
                  final isSelected = _sleepTimerMinutes == mins;
                  final label = mins == 0 ? 'Turn Off' : '$mins minutes';
                  return ListTile(
                    leading: Icon(
                      mins == 0 ? Icons.timer_off_outlined : Icons.timer_outlined,
                      color: isSelected ? const Color(AppColors.primary) : Colors.white70,
                    ),
                    title: Text(label, style: TextStyle(color: isSelected ? const Color(AppColors.primary) : Colors.white, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                    trailing: isSelected ? const Icon(Icons.check_circle_rounded, color: Color(AppColors.primary)) : null,
                    onTap: () {
                      Navigator.pop(ctx);
                      _setSleepTimer(mins);
                    },
                  );
                }),
                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
    ).then((_) => _showControlsWithTimer());
  }

  void _setSleepTimer(int minutes) {
    _sleepTimer?.cancel();
    _sleepTimerMinutes = minutes;
    if (minutes > 0) {
      _sleepTimerEndTime = DateTime.now().add(Duration(minutes: minutes));
      _sleepTimer = Timer(Duration(minutes: minutes), () {
        if (mounted) {
          _player.pause();
          setState(() {
            _sleepTimerMinutes = 0;
            _sleepTimerEndTime = null;
          });
          _showPlayerToast('😴 Sleep timer ended. Goodnight!');
        }
      });
      _showPlayerToast('Sleep timer set for $minutes min');
    } else {
      _sleepTimerEndTime = null;
      _showPlayerToast('Sleep timer turned off');
    }
    setState(() {});
  }

  Widget _buildControlsOverlay({bool fullscreen = false}) {
    final safe = MediaQuery.of(context).padding;
    return GestureDetector(
      onTap: _toggleControls,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.28, 0.65, 1.0],
            colors: [
              Color(0xDD000000), // dark top
              Color(0x00000000), // transparent mid
              Color(0x00000000), // transparent mid
              Color(0xCC000000), // dark bottom
            ],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top bar: back | Channel branding (Logo + Name) | Premium + ⋮
            _buildControlsTopBar(fullscreen: fullscreen, safeTop: fullscreen ? safe.top : 0),
            // Secondary row: LIVE badge (left) + PiP & Lock icons (right)
            _buildSecondaryBar(fullscreen: fullscreen),
            const Spacer(),
            // Center: Hero prev/play/next + Quick Actions Toolbar
            SizedBox(
              width: double.infinity,
              child: _buildCenterControls(),
            ),
            const Spacer(),
            // Bottom: EPG program name + Scrubber track + Time
            _buildLiveProgressBar(fullscreen: fullscreen, safeBottom: fullscreen ? safe.bottom : 0),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsTopBar({bool fullscreen = false, double safeTop = 0}) {
    return Padding(
      padding: EdgeInsets.fromLTRB(4, 4 + safeTop, 6, 0),
      child: Row(
        children: [
          // ── Back button ──────────────────────────────────────────────────────
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
            onPressed: _isFullScreen ? _toggleFullScreen : () {
              context.read<MiniPlayerCubit>().minimize();
            },
          ),
          const SizedBox(width: 2),
          // ── Channel Logo ──────────────────────────────────────────────────────
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: 32,
              height: 32,
              color: Colors.white.withOpacity(0.08),
              child: ChannelLogo(
                logoUrl: _currentChannel.logoUrl,
                channelName: _currentChannel.name,
                size: 32,
              ),
            ),
          ),
          const SizedBox(width: 10),
          // ── Channel Name + Category ──────────────────────────────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _currentChannel.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
                if (_currentChannel.categoryName != null && _currentChannel.categoryName!.isNotEmpty)
                  Text(
                    _currentChannel.categoryName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.65),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          // ── Right side: Smooth-live GO LIVE button (if applicable) ───────────
          if (_smoothPlaybackEnabled &&
              (_bufferReady || _showPreparingOverlay) &&
              _canGoLive &&
              (_directLiveUrl != null && _directLiveUrl!.isNotEmpty))
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: TextButton(
                onPressed: () async {
                  try {
                    _smoothWarmTimer?.cancel();
                    _smoothWarmTimer = null;
                    await _player.stop();
                    await _initializePlayer(_directLiveUrl!, {});
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
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  minimumSize: const Size(0, 24),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                ),
                child: const Text('GO LIVE', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
              ),
            ),
          // ── Premium badge ────────────────────────────────────────────────────
          Builder(builder: (ctx) {
            final licenseState = context.watch<LicenseCubit>().state;
            final isPrem = licenseState is LicenseActive && licenseState.license.isPremium;
            if (!isPrem && !_isPremium) return const SizedBox.shrink();
            return Container(
              margin: const EdgeInsets.only(right: 4),
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF4A3B00), Color(0xFF2A2000)],
                ),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.7), width: 0.8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.workspace_premium_rounded, color: Color(0xFFFFD700), size: 12),
                  SizedBox(width: 3),
                  Text('PRO', style: TextStyle(color: Color(0xFFFFD700), fontSize: 9.5, fontWeight: FontWeight.w800)),
                ],
              ),
            );
          }),
          // ── Three-dot overflow menu ──────────────────────────────────────────
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white, size: 22),
            color: const Color(0xFF1E1E2C),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            onSelected: (value) {
              if (value == 'quality') _showQualitySelector();
              if (value == 'fit') _showFitSelector();
              if (value == 'timer') _showSleepTimerSelector();
              if (value == 'share') _shareChannel();
              if (value == 'report') _reportChannel();
            },
            itemBuilder: (_) {
              String qualityLabel = 'Auto';
              if (_player.state.track.video.id != 'auto' && _player.state.track.video.h != null) {
                qualityLabel = '${_player.state.track.video.h}p';
              } else if (_selectedQuality != null) {
                qualityLabel = _selectedQuality!['label'];
              }
              return [
                PopupMenuItem(
                  value: 'quality',
                  child: Row(children: [
                    const Icon(Icons.tune_rounded, color: Colors.white70, size: 18),
                    const SizedBox(width: 12),
                    Text('Quality: $qualityLabel', style: const TextStyle(color: Colors.white, fontSize: 13)),
                  ]),
                ),
                PopupMenuItem(
                  value: 'fit',
                  child: Row(children: [
                    const Icon(Icons.aspect_ratio_rounded, color: Colors.white70, size: 18),
                    const SizedBox(width: 12),
                    Text('Aspect: ${_getFitSubtitle()}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                  ]),
                ),
                PopupMenuItem(
                  value: 'timer',
                  child: Row(children: [
                    const Icon(Icons.timer_outlined, color: Colors.white70, size: 18),
                    const SizedBox(width: 12),
                    Text(
                      _sleepTimerMinutes > 0 ? 'Timer: ${_sleepTimerMinutes}m' : 'Sleep Timer',
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ]),
                ),
                PopupMenuItem(
                  value: 'share',
                  child: Row(children: const [
                    Icon(Icons.share_outlined, color: Colors.white70, size: 18),
                    SizedBox(width: 12),
                    Text('Share Channel', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ]),
                ),
                PopupMenuItem(
                  value: 'report',
                  child: Row(children: const [
                    Icon(Icons.flag_outlined, color: Colors.white70, size: 18),
                    SizedBox(width: 12),
                    Text('Report Issue', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ]),
                ),
              ];
            },
          ),
        ],
      ),
    );
  }

  // Secondary bar: LIVE badge + Channel counter + PiP & Lock buttons
  Widget _buildSecondaryBar({bool fullscreen = false}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 4, 10, 0),
      child: Row(
        children: [
          // ── LIVE / Smooth-live badge ──────────────────────────────────────
          if (_smoothPlaybackEnabled && _bufferReady)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1565C0),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('SMOOTH', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                  Text('${(_delaySeconds ~/ 60)}m delay', style: const TextStyle(color: Colors.white70, fontSize: 7)),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.red.shade700,
                borderRadius: BorderRadius.circular(5),
                boxShadow: [BoxShadow(color: Colors.red.withOpacity(0.4), blurRadius: 8)],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedOpacity(
                    opacity: _livePulseVisible ? 1.0 : 0.2,
                    duration: const Duration(milliseconds: 400),
                    child: Container(
                      width: 5.5, height: 5.5,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    ),
                  ),
                  const SizedBox(width: 4.5),
                  const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 1.0)),
                ],
              ),
            ),
          const SizedBox(width: 8),
          // ── Channel Counter Badge ──────────────────────────────────────────
          if (_contextChannels.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.12),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                'CH ${_currentIndex + 1}/${_contextChannels.length}',
                style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600),
              ),
            ),
          const Spacer(),
          // ── PiP Button ────────────────────────────────────────────────────
          _overlayIconBtn(
            icon: Icons.picture_in_picture_alt_rounded,
            tooltip: 'Picture in Picture',
            onTap: () {
              context.read<MiniPlayerCubit>().minimize();
            },
          ),
          const SizedBox(width: 6),
          // ── Lock Button ───────────────────────────────────────────────────
          _overlayIconBtn(
            icon: Icons.lock_open_rounded,
            tooltip: 'Lock Screen',
            onTap: () {
              setState(() {
                _isLocked = true;
              });
              _showPlayerToast('🔒 Screen Locked (Tap to Unlock)');
            },
          ),
          const SizedBox(width: 6),
          // ── Fullscreen Toggle Button ──────────────────────────────────────
          _overlayIconBtn(
            icon: _isFullScreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
            tooltip: _isFullScreen ? 'Exit Fullscreen' : 'Fullscreen',
            onTap: _toggleFullScreen,
          ),
        ],
      ),
    );
  }

  Widget _buildDiagnosticOverlay() {
    final actHz = _activeDisplayMode?.refreshRate.toStringAsFixed(1) ?? 'Unknown';
    final actW = _activeDisplayMode?.width ?? 0;
    final actH = _activeDisplayMode?.height ?? 0;
    
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.black87,
        border: Border.all(color: Colors.redAccent, width: 1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('DIAGNOSTICS', style: TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold)),
          Text('UI Hz: $actHz ($actW x $actH)', style: const TextStyle(color: Colors.white, fontSize: 10)),
          Text('Video FPS: ${_currentVideoFps.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 10)),
          Text('Decoder: $_activeVideoDecoder', style: const TextStyle(color: Colors.white, fontSize: 10)),
          Text('Dropped/Delayed: $_framesDropped / $_framesDelayed', style: const TextStyle(color: Colors.white, fontSize: 10)),
          Text('Hardware Accel: ${_activeVideoDecoder == 'hardware' ? 'Yes' : 'No'}', style: const TextStyle(color: Colors.white, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _overlayIconBtn({
    required IconData icon,
    required VoidCallback onTap,
    String? tooltip,
  }) {
    return Tooltip(
      message: tooltip ?? '',
      child: GestureDetector(
        onTap: () {
          onTap();
          _showControlsWithTimer();
        },
        child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.38),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white12, width: 0.8),
          ),
          child: Icon(icon, color: Colors.white, size: 19),
        ),
      ),
    );
  }

  Widget _buildCenterControls() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Primary Row: Previous | Play/Pause | Next
        StreamBuilder<bool>(
          stream: _player.stream.playing,
          builder: (context, snapshot) {
            final isPlaying = snapshot.data ?? false;
            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Previous channel
                _centerSkipBtn(
                  icon: Icons.skip_previous_rounded,
                  onTap: _playPreviousChannel,
                ),
                const SizedBox(width: 28),
                // Play / Pause Hero Button
                GestureDetector(
                  onTap: () {
                    _userPaused = _player.state.playing;
                    _player.playOrPause();
                    _showControlsWithTimer();
                  },
                  child: Container(
                    width: 68,
                    height: 68,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Colors.white.withOpacity(0.25),
                          Colors.white.withOpacity(0.12),
                        ],
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withOpacity(0.6), width: 1.8),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 20),
                      ],
                    ),
                    child: Icon(
                      isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 40,
                    ),
                  ),
                ),
                const SizedBox(width: 28),
                // Next channel
                _centerSkipBtn(
                  icon: Icons.skip_next_rounded,
                  onTap: _playNextChannel,
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 16),
        // Secondary Quick Actions Toolbar: Volume | Brightness | Aspect | Sleep | Share
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _quickActionPill(
                icon: _volume == 0 ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                label: '${_volume.toInt()}%',
                onTap: () {
                  if (_volume > 0) {
                    _adjustVolume(-_volume);
                  } else {
                    _adjustVolume(80);
                  }
                },
              ),
              const SizedBox(width: 8),
              _quickActionPill(
                icon: Icons.brightness_medium_rounded,
                label: '${(_brightness * 100).toInt()}%',
                onTap: () {
                  double nextB = _brightness <= 0.35 ? 1.0 : (_brightness <= 0.65 ? 0.3 : 0.6);
                  setState(() { _brightness = nextB; _showBrightnessHud = true; });
                  _hudTimer?.cancel();
                  _hudTimer = Timer(const Duration(milliseconds: 1400), () {
                    if (mounted) setState(() { _showBrightnessHud = false; });
                  });
                },
              ),
              const SizedBox(width: 8),
              _quickActionPill(
                icon: Icons.aspect_ratio_rounded,
                label: _getFitSubtitle(),
                onTap: _onDoubleTapFitToggle,
              ),
              const SizedBox(width: 8),
              _quickActionPill(
                icon: Icons.timer_outlined,
                label: _sleepTimerMinutes > 0 ? '${_sleepTimerMinutes}m' : 'Timer',
                isActive: _sleepTimerMinutes > 0,
                onTap: _showSleepTimerSelector,
              ),
              const SizedBox(width: 8),
              _quickActionPill(
                icon: Icons.share_rounded,
                label: 'Share',
                onTap: _shareChannel,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _quickActionPill({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
  }) {
    return GestureDetector(
      onTap: () {
        onTap();
        _showControlsWithTimer();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5.5),
        decoration: BoxDecoration(
          color: isActive
              ? const Color(AppColors.primary).withOpacity(0.85)
              : Colors.black.withOpacity(0.45),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive
                ? const Color(AppColors.primary)
                : Colors.white.withOpacity(0.18),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 8,
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 14),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _centerSkipBtn({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: () {
        onTap();
        _showControlsWithTimer();
      },
      child: Container(
        width: 50,
        height: 50,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 32),
      ),
    );
  }

  // ─── Live Progress Bar ─────────────────────────────────────────────────────
  Widget _buildLiveProgressBar({bool fullscreen = false, double safeBottom = 0}) {
    final now = DateTime.now();
    final prog = _nowPlaying;

    double pct;
    String leftLabel;
    String rightLabel;
    String? programTitle;

    if (prog != null && prog.startTime != null && prog.endTime != null) {
      final total   = prog.endTime!.difference(prog.startTime!).inSeconds;
      final elapsed = now.difference(prog.startTime!).inSeconds;
      pct          = (total > 0 ? (elapsed / total).clamp(0.0, 1.0) : 1.0);
      leftLabel    = DateFormat('h:mm a').format(prog.startTime!.toLocal());
      rightLabel   = DateFormat('h:mm a').format(prog.endTime!.toLocal());
      programTitle = prog.title;
    } else {
      pct        = 1.0;  // at live edge
      leftLabel  = DateFormat('h:mm a').format(now);
      rightLabel = 'LIVE';
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 12 + safeBottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Programme title / Channel stream status
          Row(
            children: [
              const Icon(Icons.live_tv_rounded, color: Colors.redAccent, size: 14),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  programTitle != null && programTitle.isNotEmpty
                      ? programTitle
                      : '${_currentChannel.name} • Live Stream',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.1,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // ── Scrubber track ──────────────────────────────────────────────────
          LayoutBuilder(builder: (ctx, constraints) {
            final trackW  = constraints.maxWidth;
            final dotX    = (trackW * pct).clamp(0.0, trackW);
            const dotR    = 5.5;
            const trackH  = 4.0;

            return SizedBox(
              height: dotR * 2,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // Grey track
                  Positioned(
                    left: 0,
                    top: dotR - trackH / 2,
                    child: Container(
                      width: trackW,
                      height: trackH,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(trackH / 2),
                      ),
                    ),
                  ),
                  // Red gradient fill
                  Positioned(
                    left: 0,
                    top: dotR - trackH / 2,
                    child: Container(
                      width: dotX,
                      height: trackH,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(AppColors.primary), Colors.redAccent],
                        ),
                        borderRadius: BorderRadius.circular(trackH / 2),
                      ),
                    ),
                  ),
                  // Red glowing dot at live-edge
                  Positioned(
                    left: (dotX - dotR).clamp(0.0, trackW - dotR * 2),
                    top: 0,
                    child: Container(
                      width: dotR * 2,
                      height: dotR * 2,
                      decoration: BoxDecoration(
                        color: Colors.redAccent,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.redAccent.withOpacity(0.7),
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 5),
          // ── Time labels under track ─────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(leftLabel, style: const TextStyle(color: Colors.white70, fontSize: 10.5, fontWeight: FontWeight.w500)),
              Text(rightLabel, style: const TextStyle(color: Colors.white70, fontSize: 10.5, fontWeight: FontWeight.w500)),
            ],
          ),
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
    if (cat.contains('news')) return 'Watch live news, breaking updates, politics, business and current affairs.';
    if (cat.contains('movie')) return 'Watch live movies and premieres.';
    if (cat.contains('business')) return 'Watch live business, markets and money news.';
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

  bool _isChannelLocked(ChannelModel c) {
    if (c.channelTier == 'free') return false;
    final licenseState = context.read<LicenseCubit>().state;
    final bool hasPro = licenseState is LicenseActive && licenseState.license.hasProAccess;
    final bool hasPlus = licenseState is LicenseActive && licenseState.license.hasPlusAccess;
    if (c.channelTier == 'plus' && !hasPlus) return true;
    if (c.channelTier == 'pro' && !hasPro) return true;
    return false;
  }

  Widget _buildRelatedCard(ChannelModel ch) {
    return PremiumChannelCard(
      channel: ch,
      variant: PremiumChannelCardVariant.related,
      isLocked: _isChannelLocked(ch),
      onTap: () => _playChannel(ch),
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
    return PremiumChannelCard(
      channel: ch,
      variant: PremiumChannelCardVariant.list,
      margin: EdgeInsets.zero,
      isLocked: _isChannelLocked(ch),
      onTap: () => _playChannel(ch),
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
