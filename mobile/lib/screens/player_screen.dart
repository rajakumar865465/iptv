import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import '../constants.dart';
import '../models/channel_model.dart';

class PlayerScreen extends StatefulWidget {
  final ChannelModel channel;
  final List<ChannelModel>? channels;
  final int? initialIndex;

  const PlayerScreen({
    super.key,
    required this.channel,
    this.channels,
    this.initialIndex,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  VideoPlayerController? _controller;
  bool _isLoading = true;
  bool _hasError = false;
  bool _isFullScreen = false;
  bool _showControls = true;
  String _currentUrl = '';
  late int _currentIndex;
  late List<ChannelModel> _channelList;

  @override
  void initState() {
    super.initState();
    // Initialize channel list and index
    _channelList = widget.channels ?? [widget.channel];
    _currentIndex = widget.initialIndex ??
        _channelList.indexWhere((c) => c.id == widget.channel.id);
    if (_currentIndex < 0) _currentIndex = 0;

    _currentUrl = widget.channel.streamUrl;
    _initializePlayer(_currentUrl);
  }

  Future<void> _initializePlayer(String url) async {
    if (_controller != null) {
      await _controller!.dispose();
      _controller = null;
    }

    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      // Build HTTP headers for stream
      final Map<String, String> headers = {};
      if (_currentChannel.referrer != null && _currentChannel.referrer!.isNotEmpty) {
        headers['Referer'] = _currentChannel.referrer!;
      }
      if (_currentChannel.userAgent != null && _currentChannel.userAgent!.isNotEmpty) {
        headers['User-Agent'] = _currentChannel.userAgent!;
      }

      if (headers.isNotEmpty) {
        _controller = VideoPlayerController.networkUrl(
          Uri.parse(url),
          httpHeaders: headers,
        );
      } else {
        _controller = VideoPlayerController.networkUrl(Uri.parse(url));
      }

      await _controller!.initialize();
      await _controller!.play();
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = false;
        });
      }
    } catch (e) {
      // If main stream fails and we haven't tried backup yet
      if (url == _currentChannel.streamUrl &&
          _currentChannel.backupStreamUrl != null &&
          _currentChannel.backupStreamUrl!.isNotEmpty) {
        if (mounted) {
          setState(() {
            _currentUrl = _currentChannel.backupStreamUrl!;
          });
        }
        await _initializePlayer(_currentChannel.backupStreamUrl!);
        return;
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = true;
        });
      }
    }
  }

  ChannelModel get _currentChannel => _channelList[_currentIndex];

  @override
  void dispose() {
    _controller?.dispose();
    if (_isFullScreen) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }

  void _toggleFullScreen() {
    setState(() {
      _isFullScreen = !_isFullScreen;
      if (_isFullScreen) {
        SystemChrome.setPreferredOrientations([
          DeviceOrientation.landscapeLeft,
          DeviceOrientation.landscapeRight,
        ]);
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      } else {
        SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      }
    });
  }

  void _retry() {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });
    _initializePlayer(_currentUrl);
  }

  void _playNextChannel() {
    if (_channelList.length < 2) return;
    if (_currentIndex >= _channelList.length - 1) {
      setState(() => _currentIndex = 0);
    } else {
      setState(() => _currentIndex++);
    }
    _currentUrl = _currentChannel.streamUrl;
    _initializePlayer(_currentUrl);
  }

  void _playPreviousChannel() {
    if (_channelList.length < 2) return;
    if (_currentIndex <= 0) {
      setState(() => _currentIndex = _channelList.length - 1);
    } else {
      setState(() => _currentIndex--);
    }
    _currentUrl = _currentChannel.streamUrl;
    _initializePlayer(_currentUrl);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () {
          setState(() => _showControls = !_showControls);
        },
        child: Stack(
          children: [
            // Video Player
            if (_controller != null && _controller!.value.isInitialized)
              Center(
                child: AspectRatio(
                  aspectRatio: _controller!.value.aspectRatio,
                  child: VideoPlayer(_controller!),
                ),
              )
            else if (_isLoading)
              const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: Color(AppColors.primary)),
                    SizedBox(height: 16),
                    Text('Loading stream...', style: TextStyle(color: Colors.white)),
                  ],
                ),
              )
            else if (_hasError)
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 64, color: Colors.white54),
                    const SizedBox(height: 16),
                    const Text(
                      'This channel is currently unavailable.',
                      style: TextStyle(color: Colors.white, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Please try again later.',
                      style: TextStyle(color: Colors.white54),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _retry,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),

            // Controls overlay
            if (_showControls && _controller != null && _controller!.value.isInitialized)
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.7),
                      Colors.transparent,
                      Colors.transparent,
                      Colors.black.withOpacity(0.7),
                    ],
                  ),
                ),
                child: Column(
                  children: [
                    // Top bar
                    SafeArea(
                      child: ListTile(
                        leading: IconButton(
                          icon: const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                        title: Text(
                          _currentChannel.name,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        subtitle: _currentChannel.categoryName != null
                            ? Text(_currentChannel.categoryName!, style: const TextStyle(color: Colors.white70))
                            : null,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_channelList.length > 1)
                              Text(
                                '${_currentIndex + 1}/${_channelList.length}',
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            IconButton(
                              icon: const Icon(Icons.fullscreen, color: Colors.white),
                              onPressed: _toggleFullScreen,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    // Bottom controls
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.skip_previous, color: Colors.white, size: 36),
                              onPressed: _playPreviousChannel,
                            ),
                            const SizedBox(width: 24),
                            IconButton(
                              icon: Icon(
                                _controller!.value.isPlaying ? Icons.pause : Icons.play_arrow,
                                color: Colors.white,
                                size: 48,
                              ),
                              onPressed: () {
                                setState(() {
                                  _controller!.value.isPlaying
                                      ? _controller!.pause()
                                      : _controller!.play();
                                });
                              },
                            ),
                            const SizedBox(width: 24),
                            IconButton(
                              icon: const Icon(Icons.skip_next, color: Colors.white, size: 36),
                              onPressed: _playNextChannel,
                            ),
                          ],
                        ),
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
}
