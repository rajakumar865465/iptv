import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:shimmer/shimmer.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
import '../models/channel_model.dart';
import '../services/api_service.dart';
import '../widgets/channel_logo.dart';

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
  int _fitIndex = 0;

  List<dynamic> _backupStreams = [];
  Map<String, dynamic>? _currentStreamMeta;
  bool _isRetryingStream = false;
  String _streamOverlayMessage = '';
  // Fix #2: Separate timer with null reset to prevent stacking
  Timer? _bufferTimer;
  StreamSubscription? _playerSubscription;
  // Track if playback succeeded after a retry — report as 'played_after_retry' (unstable)
  bool _hadFailureBeforePlaying = false;

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

  @override
  void initState() {
    super.initState();
    _channelList = widget.channels ?? [widget.channel];
    _currentIndex = widget.initialIndex ?? _channelList.indexWhere((c) => c.id == widget.channel.id);
    if (_currentIndex < 0) _currentIndex = 0;
    _currentUrl = _currentChannel.streamUrl;

    // Fix #1: Initialize media_kit player
    _player = Player();
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
    _fetchPlaybackAndInitialize();
    _loadChannelData();
    _loadMoreLiveChannels();
  }

  // ──────────────────────── Player ────────────────────────

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
        
        String urlToPlay = _currentStreamMeta!['url'];
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

  Future<void> _initializePlayer(String url, [Map<String, dynamic>? rawHeaders]) async {
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
      await _player.open(media);
      await _player.play();

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

      // ── Wait for actual playback to start ─────────────────────────────
      // Use stream.playing where value == true, not .first (which fires on
      // the first event regardless of whether it's true or false).
      _player.stream.playing
          .where((playing) => playing == true)
          .first
          .then((_) {
        if (mounted) {
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
      // If neither "playing=true" nor buffering events fire within 30 seconds
      // the stream is genuinely dead. This is a last-resort fallback only.
      _bufferTimer = Timer(const Duration(seconds: 30), () {
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
        _bufferTimer ??= Timer(const Duration(seconds: 20), () {
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
    switch (_fitIndex) {
      case 1: return BoxFit.cover;
      case 2: return BoxFit.fill;
      default: return BoxFit.contain;
    }
  }

  String _getFitLabel() {
    switch (_fitIndex) {
      case 1: return 'Cover';
      case 2: return 'Fill';
      default: return 'Fit';
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
    setState(() { _fitIndex = (_fitIndex + 1) % 3; });
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
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _isFullScreen ? _buildFullscreen() : _buildPortrait(),
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
    // Fix #1: Use media_kit Video widget — handles HLS, custom headers, aspect ratio natively
    return Video(
      controller: _videoController,
      fit: _getBoxFit(),
      controls: NoVideoControls,
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
    if (_moreLiveChannels.isEmpty && _moreLoading) {
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 2.3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
          ),
          delegate: SliverChildBuilderDelegate(
            (_, __) => _buildGridShimmer(),
            childCount: 6,
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 2.3,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) => _buildMoreLiveCard(_moreLiveChannels[index]),
          childCount: _moreLiveChannels.length,
        ),
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
