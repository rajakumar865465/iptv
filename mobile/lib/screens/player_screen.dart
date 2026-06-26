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
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
import '../models/channel_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/channel_logo.dart';
import '../cubits/license_cubit.dart';
import '../cubits/auth_cubit.dart';
import '../utils/backend_config.dart';

class PlayerScreen extends StatefulWidget {
  final ChannelModel channel;
  final List<ChannelModel>? channels;
  final int? initialIndex;

  const PlayerScreen({super.key, required this.channel, this.channels, this.initialIndex});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

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
  late List<ChannelModel> _channelList;
  Timer? _controlsTimer;
  final GlobalKey _videoKey = GlobalKey();

  List<dynamic> _backupStreams = [];
  Map<String, dynamic>? _currentStreamMeta;
  bool _isRetryingStream = false;
  String _streamOverlayMessage = '';
  Timer? _bufferTimer;
  StreamSubscription? _playerSubscription;
  bool _hadFailureBeforePlaying = false;

  // Video Quality state
  List<dynamic> _qualities = [];
  Map<String, dynamic>? _selectedQuality;
  bool _dataSaverEnabled = false;
  String _defaultQualityPref = 'auto';
  bool _autoMobileData = true;
  bool _hdOnlyWifi = true;
  bool _isOnMobileData = false;
  String _fitMode = 'auto';
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
  final Set<int> _moreChannelIds = {};
  int _morePage = 1;
  bool _moreHasMore = true;
  bool _moreLoading = false;

  final List<DateTime> _bufferingEvents = [];

  @override
  void initState() {
    super.initState();
    _channelList = widget.channels ?? [widget.channel];
    _currentIndex = widget.initialIndex ?? _channelList.indexWhere((c) => c.id == widget.channel.id);
    if (_currentIndex < 0) _currentIndex = 0;
    _currentUrl = _currentChannel.streamUrl;

    // Fix #1: Initialize media_kit player with optimized Netflix-style fast-start configuration
    _player = Player(
      configuration: const PlayerConfiguration(
        // Increase buffer size to 32MB (from 2MB) to prevent buffering micro-stutters
        bufferSize: 1024 * 1024 * 32,
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
    _loadMoreLiveChannels();
  }

  // ──────────────────────── Player ────────────────────────

  Future<void> _loadQualitySettingsAndFetch() async {
    final storage = StorageService();
    _defaultQualityPref = await storage.getVideoQualityPreference();
    _dataSaverEnabled = await storage.isDataSaverEnabled();
    _autoMobileData = await storage.isAutoQualityOnMobileData();
    _hdOnlyWifi = await storage.isHdOnlyOnWifi();
    _fitMode = await storage.getVideoFitMode();

    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      _isOnMobileData = connectivityResult.contains(ConnectivityResult.mobile);
    } catch (_) {}

    _fetchPlaybackAndInitialize();
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

  Future<void> _fetchPlaybackAndInitialize() async {
    // Fix #3: Cancel any pending buffer timer before starting a new stream to prevent
    // the old channel's timeout from firing and setting _isRetryingStream on the new one.
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _playerSubscription?.cancel();
    _playerSubscription = null;

    if (mounted) setState(() { _isLoading = true; _hasError = false; _streamOverlayMessage = ''; _isRetryingStream = false; });
    try {
      final res = await _api.get('${ApiEndpoints.channels}/${_currentChannel.id}/playback');
      if (res['success'] == true) {
        final data = res['data'];
        _currentStreamMeta = data['primary_stream'];
        _backupStreams = data['backup_streams'] ?? [];
        _qualities = data['qualities'] ?? [];
        
        _selectedQuality = _determineInitialQuality();
        
        String urlToPlay = _selectedQuality != null ? _selectedQuality!['url'] : _currentStreamMeta!['url'];
        await _initializePlayer(urlToPlay, _currentStreamMeta!['headers']);
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
    _bufferTimer?.cancel();
    _bufferTimer = null;
    if (mounted) setState(() { _isLoading = true; _hasError = false; });

    try {
      final Map<String, String> headers = {};
      if (rawHeaders != null) {
        rawHeaders.forEach((k, v) {
          if (v != null && v.toString().isNotEmpty) headers[k] = v.toString();
        });
      }

      final media = Media(url, httpHeaders: headers.isNotEmpty ? headers : null);
      
      // Fix: Use open(play: true) and remove redundant play() call to shave off milliseconds
      await _player.open(media, play: true);
      if (startPosition != null) {
        await _player.seek(startPosition);
      }

      // ── Listen for buffering changes ──────────────────────────────────
      _playerSubscription = _player.stream.buffering.listen(_onBufferingChanged);

      // ── Listen for errors ─────────────────────────────────────────────
      // media_kit fires error events during normal HLS playlist resolution
      // (e.g. "Failed to open" before retrying internally). We add a small
      // grace delay so transient init errors don't trigger failure immediately.
      _player.stream.error.listen((errorMsg) {
        if (errorMsg.isEmpty || !mounted) return;
        // Ignore errors that arrive within the first 3 seconds — these are
        // almost always transient HLS init events, not real stream failures.
        Future.delayed(const Duration(seconds: 3), () {
          if (!mounted || !_isLoading) return; // already playing — ignore
          _handleStreamFailure('player_error');
        });
      });

      // ── Wait for actual video to be ready ─────────────────────────────
      // 'playing' becomes true instantly, but 'videoParams' only updates
      // when the video stream is actually parsed and ready to render.
      _player.stream.videoParams
          .where((p) => p.w != null && p.w! > 0)
          .first
          .timeout(const Duration(seconds: 15), onTimeout: () => const VideoParams())
          .then((params) {
        if (mounted && params.w != null) {
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
          _showControlsWithTimer();
          // Report playback result to backend
          _reportPlaybackSuccess();
        }
      });

      // ── Safety timeout ────────────────────────────────────────────────
      // If neither "playing=true" nor buffering events fire within 15 seconds
      // the stream is genuinely dead. Fast failover (15s instead of 30s).
      _bufferTimer = Timer(const Duration(seconds: 15), () {
        if (mounted && _isLoading && !_hasError) {
          _handleStreamFailure('init_timeout');
        }
      });

    } catch (e) {
      _handleStreamFailure('init_failed');
    }
  }

  // Fix #2: Buffering timer — only fires after sustained buffering, not on initial load.
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

        if (_bufferingEvents.length >= 3 && _isPremium && !_currentUrl.contains('/api/stream/transcode/')) {
          _showNetworkSlowPrompt();
          _bufferingEvents.clear();
        }

        _bufferTimer ??= Timer(const Duration(seconds: 10), () {
          if (mounted) _handleStreamFailure('buffer_timeout');
        });
      }
    } else {
      // Buffering cleared — cancel stall timer and clear loading spinner
      _bufferTimer?.cancel();
      _bufferTimer = null;
      if (mounted && _isLoading) {
        setState(() {
          _isLoading = false;
          _isRetryingStream = false;
          _streamOverlayMessage = '';
        });
        _showControlsWithTimer();
      }
    }
  }

  void _showNetworkSlowPrompt() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Slow connection detected. Switch to Data Saver for smooth playback?'),
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'SWITCH',
          textColor: AppColors.accent,
          onPressed: () {
            if (_isPremium && !_currentUrl.contains('/api/stream/transcode/')) {
              if (mounted) setState(() { _streamOverlayMessage = 'Auto-switching to smooth proxy...'; _isLoading = true; _hasError = false; });
              _isRetryingStream = false;
              final authState = context.read<AuthCubit>().state;
              final token = authState is AuthAuthenticated ? authState.token : '';
              final fallbackUrl = '${BackendConfig.baseUrl}/api/stream/transcode/${_currentChannel.id}?quality=360&token=$token';
              
              _currentStreamMeta = {
                'url': fallbackUrl,
                'headers': {},
              };
              _initializePlayer(fallbackUrl, {});
            }
          },
        ),
      ),
    );
  }

  Future<void> _handleStreamFailure(String reason) async {
    if (_isRetryingStream) return;
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _isRetryingStream = true;
    _hadFailureBeforePlaying = true; // mark that we had a failure before success

    try {
      await _api.post('${ApiEndpoints.channels}/${_currentChannel.id}/report-failure', {
        'reason': reason,
        'stream_url': _currentUrl,
        'stream_id': _currentStreamMeta?['id'],
      });
    } catch(e) {}

    // Try lower quality first if it was a buffer stall
    if (reason == 'buffer_timeout' && _selectedQuality != null && _qualities.isNotEmpty) {
      int currentHeight = _selectedQuality!['height'] ?? 9999;
      if (_selectedQuality!['type'] == 'auto') currentHeight = 9999; // Assume auto is max for downgrade

      dynamic lowerQuality;
      for (var q in _qualities) {
        if (q['type'] == 'auto') continue;
        int h = q['height'] ?? 0;
        if (h > 0 && h < currentHeight) {
          if (lowerQuality == null || h > (lowerQuality['height'] ?? 0)) {
            lowerQuality = q;
          }
        }
      }

      if (lowerQuality != null) {
        if (mounted) setState(() { _streamOverlayMessage = 'Auto-switching to lower quality...'; _isLoading = true; _hasError = false; });
        _selectedQuality = lowerQuality;
        _isRetryingStream = false;
        await _initializePlayer(lowerQuality['url'], lowerQuality['headers'] ?? _currentStreamMeta!['headers']);
        return;
      }

      // Smart Fallback to AWS Server (Auto-Transcode) for Premium users
      if (_isPremium && !_currentUrl.contains('/api/stream/transcode/')) {
        if (mounted) setState(() { _streamOverlayMessage = 'Auto-switching to smooth proxy...'; _isLoading = true; _hasError = false; });
        _isRetryingStream = false;
        final authState = context.read<AuthCubit>().state;
        final token = authState is AuthAuthenticated ? authState.token : '';
        final fallbackUrl = '${BackendConfig.baseUrl}/api/stream/transcode/${_currentChannel.id}?quality=360&token=$token';
        
        _currentStreamMeta = {
          'url': fallbackUrl,
          'headers': {},
        };
        await _initializePlayer(fallbackUrl, {});
        return;
      }
    }

    if (_backupStreams.isNotEmpty) {
      if (mounted) setState(() { _streamOverlayMessage = 'Trying backup source...'; _isLoading = true; _hasError = false; });
      final backup = _backupStreams.removeAt(0);
      _currentStreamMeta = backup;
      _isRetryingStream = false; // allow next failure cycle on the backup stream
      await _initializePlayer(backup['url'], backup['headers']);
      return;
    }

    if (mounted) setState(() { _isLoading = false; _hasError = true; _streamOverlayMessage = ''; });
  }

  /// Reports successful playback to backend.
  /// If the stream played after a prior failure/retry, marks it as 'unstable' (not offline).
  Future<void> _reportPlaybackSuccess() async {
    try {
      final result = _hadFailureBeforePlaying ? 'played_after_retry' : 'played';
      await _api.post('${ApiEndpoints.channels}/${_currentChannel.id}/playback-result', {
        'result': result,
        'status': _hadFailureBeforePlaying ? 'unstable' : 'online',
        'stream_url': _currentUrl,
      });
    } catch (_) {}
  }

  // ──────────────────────── Data Loading ────────────────────────

  Future<void> _loadChannelData() async {
    final channelId = _currentChannel.id;
    if (mounted) setState(() { _loadingEPG = true; _loadingRelated = true; });

    // EPG Now Playing
    try {
      final nowRes = await _api.get('${ApiEndpoints.channels}/$channelId/epg/now');
      if (mounted && nowRes['success'] == true && nowRes['data'] != null) {
        _nowPlaying = EpgProgram.fromJson(nowRes['data']);
      }
    } catch (_) {
      _nowPlaying = null;
    }

    // Upcoming EPG
    try {
      final upcomingRes = await _api.get('${ApiEndpoints.channels}/$channelId/epg/upcoming');
      if (mounted && upcomingRes['success'] == true && upcomingRes['data'] != null) {
        _upcoming = (upcomingRes['data'] as List).map((p) => EpgProgram.fromJson(p)).toList();
      }
    } catch (_) {
      _upcoming = [];
    }

    if (mounted) setState(() { _loadingEPG = false; });

    // Related Channels
    try {
      final relatedRes = await _api.get('${ApiEndpoints.channels}/$channelId/related');
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
      _loadMoreLiveChannels();
    }
  }

  Future<void> _loadMoreLiveChannels() async {
    if (_moreLoading || !_moreHasMore) return;
    if (mounted) setState(() { _moreLoading = true; });
    try {
      final res = await _api.get(ApiEndpoints.channels, queryParameters: {
        'page': _morePage.toString(),
        'limit': '20',
      });
      if (!mounted) return;
      if (res['success'] == true) {
        final data = res['data'] as List? ?? [];
        final pagination = res['pagination'] as Map<String, dynamic>?;
        final newChannels = data
            .map((c) => ChannelModel.fromJson(c))
            .where((c) => c.id != _currentChannel.id && !_moreChannelIds.contains(c.id))
            .toList();
        setState(() {
          for (final ch in newChannels) {
            _moreChannelIds.add(ch.id);
            _moreLiveChannels.add(ch);
          }
          _morePage++;
          _moreHasMore = pagination?['hasMore'] == true;
          _moreLoading = false;
        });
      } else {
        if (mounted) setState(() { _moreLoading = false; _moreHasMore = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _moreLoading = false; });
    }
  }

  void _resetMoreLiveChannels() {
    _moreLiveChannels = [];
    _moreChannelIds.clear();
    _morePage = 1;
    _moreHasMore = true;
    _moreLoading = false;
  }

  // ──────────────────────── Channel Navigation ────────────────────────

  ChannelModel get _currentChannel => _channelList[_currentIndex];

  void _playChannel(ChannelModel ch) {
    int index = _channelList.indexWhere((c) => c.id == ch.id);
    if (index < 0) {
      _channelList.add(ch);
      index = _channelList.length - 1;
    }
    setState(() {
      _currentIndex = index;
      _currentUrl = ch.streamUrl;
      _nowPlaying = null;
      _upcoming = [];
      _relatedChannels = [];
      _relatedSourceType = '';
      _hadFailureBeforePlaying = false; // reset retry tracking for new channel
      _resetMoreLiveChannels();
    });
    if (_scrollController.hasClients) {
      _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
    _fetchPlaybackAndInitialize();
    _loadChannelData();
    _loadMoreLiveChannels();
  }

  void _playNextChannel() {
    if (_channelList.length < 2) return;
    int next = (_currentIndex + 1) % _channelList.length;
    for (int i = 0; i < _channelList.length; i++) {
      if (_channelList[next].streamUrl.isNotEmpty) {
        _playChannel(_channelList[next]);
        return;
      }
      next = (next + 1) % _channelList.length;
    }
  }

  void _playPreviousChannel() {
    if (_channelList.length < 2) return;
    int prev = (_currentIndex - 1 + _channelList.length) % _channelList.length;
    for (int i = 0; i < _channelList.length; i++) {
      if (_channelList[prev].streamUrl.isNotEmpty) {
        _playChannel(_channelList[prev]);
        return;
      }
      prev = (prev - 1 + _channelList.length) % _channelList.length;
    }
  }

  // ──────────────────────── Controls Logic ────────────────────────

  BoxFit _getBoxFit() {
    String mode = _fitMode;
    if (mode == 'auto') {
      final width = _player.state.width;
      final height = _player.state.height;
      if (width != null && height != null && height > 0) {
        final aspect = width / height;
        if (aspect > 1.6 && aspect < 1.9) {
          mode = 'fill';
        } else {
          mode = 'fit';
        }
      } else {
        mode = 'fit';
      }
    }

    switch (mode) {
      case 'fill':
      case 'zoom':
        return BoxFit.cover;
      case 'stretch':
        return BoxFit.fill;
      case 'fit':
      default:
        return BoxFit.contain;
    }
  }

  double _getTransformScale() {
    if (_fitMode == 'zoom') return 1.15;
    return 1.0;
  }

  String _getFitLabel() {
    switch (_fitMode) {
      case 'fit': return 'Fit';
      case 'fill': return 'Fill';
      case 'zoom': return 'Zoom';
      case 'stretch': return 'Stretch';
      case 'auto':
      default: return 'Auto';
    }
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
    _controlsTimer = Timer(const Duration(seconds: 4), _hideControls);
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

  void _cycleFit() {
    final modes = ['auto', 'fit', 'fill', 'zoom', 'stretch'];
    int currentIndex = modes.indexOf(_fitMode);
    if (currentIndex == -1) currentIndex = 0;
    
    setState(() {
      _fitMode = modes[(currentIndex + 1) % modes.length];
    });
    
    StorageService().setVideoFitMode(_fitMode);
    _showControlsWithTimer();
  }

  void _retry() {
    setState(() { _isLoading = true; _hasError = false; _isRetryingStream = false; });
    _bufferTimer?.cancel();
    _bufferTimer = null;
    _fetchPlaybackAndInitialize();
  }

  String _formatTimeRange(DateTime? start, DateTime? end) {
    if (start == null || end == null) return '';
    final fmt = DateFormat('h:mm a');
    return '${fmt.format(start.toLocal())} – ${fmt.format(end.toLocal())}';
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
    _controlsTimer?.cancel();
    _playerSubscription?.cancel();
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

  // ──────────────────────── Fullscreen ────────────────────────

  Widget _buildFullscreen() {
    return GestureDetector(
      onTap: _toggleControls,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _buildVideoSurface(),
          if (_isLoading) _buildLoadingOverlay(),
          if (_hasError) _buildErrorOverlay(),
          // Controls overlay — always in DOM, opacity-animated
          FadeTransition(
            opacity: _controlsOpacity,
            child: IgnorePointer(
              ignoring: !_showControls,
              child: _buildControlsOverlay(fullscreen: true),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────── Portrait ────────────────────────

  Widget _buildPortrait() {
    return Column(
      children: [
        // ── Video area (16:9) ──
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Container(
            color: Colors.black,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _buildVideoSurface(),

                // ← Transparent tap layer directly above video surface
                Positioned.fill(
                  child: GestureDetector(
                    onTap: _toggleControls,
                    behavior: HitTestBehavior.translucent,
                    child: const SizedBox.expand(),
                  ),
                ),

                if (_isLoading) _buildLoadingOverlay(),
                if (_hasError) _buildErrorOverlay(),

                // Controls overlay
                if (!_hasError && !_isLoading)
                  FadeTransition(
                    opacity: _controlsOpacity,
                    child: IgnorePointer(
                      ignoring: !_showControls,
                      child: _buildControlsOverlay(),
                    ),
                  ),
              ],
            ),
          ),
        ),

        // ── Scrollable info area ──
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

  // ──────────────────────── Video Surface ────────────────────────

  Widget _buildVideoSurface() {
    return Transform.scale(
      key: _videoKey,
      scale: _getTransformScale(),
      child: Video(
        controller: _videoController,
        fit: _getBoxFit(),
        controls: NoVideoControls,
        filterQuality: FilterQuality.high,
      ),
    );
  }

  Widget _buildLoadingOverlay() {
    return Container(
      color: Colors.black87,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: Color(AppColors.primary), strokeWidth: 3),
            if (_streamOverlayMessage.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(_streamOverlayMessage, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ],
        ),
      ),
    );
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
                'Stream Unavailable',
                style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'This channel is offline or not supported in your region.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _actionButton(Icons.refresh_rounded, 'Retry', _retry),
                  if (_channelList.length > 1) ...[
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

  // ──────────────────────── Pro Player Controls Overlay ────────────────────────

  Widget _buildControlsOverlay({bool fullscreen = false}) {
    return GestureDetector(
      onTap: _toggleControls, // tap on controls = reset auto-hide timer
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.35, 0.65, 1.0],
            colors: [
              Color(0xCC000000),
              Color(0x22000000),
              Color(0x22000000),
              Color(0xCC000000),
            ],
          ),
        ),
        child: Column(
          children: [
            // ── Top bar ──
            _buildControlsTopBar(),
            const Spacer(),
            // ── Center play controls ──
            _buildCenterControls(),
            const Spacer(),
            // ── Bottom bar ──
            _buildControlsBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsTopBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 8, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
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
                    shadows: [Shadow(blurRadius: 8, color: Colors.black)],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (_currentChannel.categoryName != null)
                  Text(
                    _currentChannel.categoryName!,
                    style: const TextStyle(color: Colors.white60, fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          // LIVE indicator
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
            // Play / Pause — large circle button
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

  Widget _buildControlsBottomBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          // Quality selector
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
          // Aspect ratio toggle
          GestureDetector(
            onTap: _cycleFit,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.white24),
              ),
              child: Text(
                _getFitLabel(),
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          if (_channelList.length > 1) ...[
            const SizedBox(width: 10),
            Text(
              '${_currentIndex + 1} / ${_channelList.length}',
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
                            final token = await StorageService().getToken() ?? '';
                            _changeQuality({'label': '480p Data Saver', 'url': '${BackendConfig.baseUrl}/api/stream/transcode/${_currentChannel.id}?quality=480&token=$token'});
                          }
                        }),
                        _buildQualityTile('360p Data Saver', 'Maximum data savings', _selectedQuality?['label'] == '360p Data Saver', !isPremium, () async {
                          if (!isPremium) {
                            _showPremiumPaywall();
                          } else {
                            Navigator.pop(context);
                            final token = await StorageService().getToken() ?? '';
                            _changeQuality({'label': '360p Data Saver', 'url': '${BackendConfig.baseUrl}/api/stream/transcode/${_currentChannel.id}?quality=360&token=$token'});
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

    setState(() {
      _selectedQuality = quality;
      _streamOverlayMessage = 'Changing quality...';
    });

    final headers = quality['headers'] ?? _currentStreamMeta?['headers'] ?? {};
    await _initializePlayer(quality['url'], headers, position);
  }

  // ──────────────────────── Channel Info ────────────────────────

  Widget _buildChannelInfo() {
    final categoryLabel = _getCategoryLabel(_currentChannel.categoryName);
    final lang = _currentChannel.language;
    final quality = _currentChannel.quality;
    final showLang = lang != null && lang.trim().isNotEmpty && lang.toLowerCase() != 'unknown';
    final showQuality = quality != null && quality.trim().isNotEmpty;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ChannelLogo(
          logoUrl: _currentChannel.logoUrl,
          localLogoUrl: _currentChannel.localLogoUrl,
          channelName: _currentChannel.name,
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
        BlocBuilder<FavoriteCubit, FavoriteState>(
          builder: (context, state) {
            final isFav = state is FavoriteLoaded && state.favorites.any((c) => c.id == _currentChannel.id);
            return IconButton(
              icon: Icon(isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: isFav ? Colors.red : Colors.white54, size: 26),
              onPressed: () => context.read<FavoriteCubit>().toggleFavorite(_currentChannel.id, isFavorite: isFav),
            );
          },
        ),
      ],
    );
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

  // ──────────────────────── Now Playing Card ────────────────────────

  Widget _buildNowPlayingCard() {
    if (_loadingEPG) return _buildCardShimmer(height: 120);

    final hasEPG = _nowPlaying != null && _nowPlaying!.startTime != null;
    final title = hasEPG ? _nowPlaying!.title : 'Live: ${_currentChannel.name}';
    final timeStr = hasEPG
        ? _formatTimeRange(_nowPlaying!.startTime, _nowPlaying!.endTime)
        : '${_getCategoryLabel(_currentChannel.categoryName)} • Live Broadcast';
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

  // ──────────────────────── Upcoming Card ────────────────────────

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

  // ──────────────────────── Related Channels ────────────────────────

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

    // Only show related section if the API returned real data — don't fall back to channelList
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
        .join(' • ');

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

  // ──────────────────────── More Live Channels (paginated) ────────────────────────

  Widget _buildMoreLiveHeader() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        child: _sectionHeader('MORE LIVE CHANNELS'),
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
          : !_moreHasMore && _moreLiveChannels.isNotEmpty
              ? const Center(child: Text("You've reached the end", style: TextStyle(color: Colors.white24, fontSize: 12)))
              : const SizedBox.shrink(),
    );
  }

  Widget _buildMoreLiveCard(ChannelModel ch) {
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
              top: 5,
              right: 5,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(3)),
                child: const Text('LIVE', style: TextStyle(fontSize: 7, fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  ChannelLogo(logoUrl: ch.logoUrl, localLogoUrl: ch.localLogoUrl, channelName: ch.name, size: 38, borderRadius: 8),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(ch.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                        const SizedBox(height: 3),
                        Text(_getCategoryLabel(ch.categoryName),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 9, color: Colors.white38)),
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

  // ──────────────────────── Helpers & Shimmers ────────────────────────

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
