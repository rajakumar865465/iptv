import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubits/mini_player_cubit.dart';
import '../screens/player_screen.dart';

class MiniPlayerOverlay extends StatefulWidget {
  const MiniPlayerOverlay({super.key});

  @override
  State<MiniPlayerOverlay> createState() => _MiniPlayerOverlayState();
}

class _MiniPlayerOverlayState extends State<MiniPlayerOverlay> with WidgetsBindingObserver {
  final GlobalKey _playerKey = GlobalKey();
  
  bool _isDragging = false;
  double? _dragX;
  double? _dragY;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Future<bool> didPopRoute() async {
    final cubit = context.read<MiniPlayerCubit>();
    if (cubit.state.state == MiniPlayerStateEnum.fullscreen) {
      cubit.minimize();
      return true; // Intercept back button, don't pop underlying routes
    }
    return false; // Let the system/Navigator handle the back button normally
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MiniPlayerCubit, MiniPlayerState>(
      builder: (context, state) {
        if (state.state == MiniPlayerStateEnum.hidden || state.channel == null) {
          return const SizedBox.shrink();
        }

        final isMinimized = state.state == MiniPlayerStateEnum.minimized;
        final isOsPipMode = state.isOsPipMode;

        final screenWidth = MediaQuery.of(context).size.width;
        final screenHeight = MediaQuery.of(context).size.height;
        final paddingBottom = MediaQuery.of(context).padding.bottom;
        final paddingTop = MediaQuery.of(context).padding.top;

        final minWidth = screenWidth > 600 ? 320.0 : screenWidth * 0.45;
        final minHeight = minWidth * (9 / 16);

        final defaultLeft = screenWidth - minWidth - 20;
        final defaultTop = screenHeight - minHeight - 20 - paddingBottom;

        double top, left, width, height;

        if (!isMinimized || isOsPipMode) {
          // Fullscreen or OS PiP (fills available window)
          top = 0;
          left = 0;
          width = screenWidth;
          height = screenHeight;
        } else {
          // Minimized
          top = _dragY ?? defaultTop;
          left = _dragX ?? defaultLeft;
          width = minWidth;
          height = minHeight;
        }

        Widget playerWidget = PlayerScreen(
          key: _playerKey,
          channel: state.channel!,
          channels: state.contextChannels,
          initialIndex: state.initialIndex,
          sourceType: state.sourceType,
          sourceFilters: state.sourceFilters,
          isMinimized: isMinimized,
          isOsPipMode: isOsPipMode,
        );

        return AnimatedPositioned(
          duration: _isDragging || isOsPipMode 
              ? Duration.zero 
              : const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          top: top,
          left: left,
          width: width,
          height: height,
          child: GestureDetector(
            onTap: isMinimized ? () {
              context.read<MiniPlayerCubit>().expand();
            } : null,
            onPanStart: isMinimized ? (details) {
              setState(() { _isDragging = true; });
            } : null,
            onPanUpdate: isMinimized ? (details) {
              setState(() {
                _dragX = (_dragX ?? defaultLeft) + details.delta.dx;
                _dragY = (_dragY ?? defaultTop) + details.delta.dy;
              });
            } : null,
            onPanEnd: isMinimized ? (details) {
              setState(() {
                _isDragging = false;
                final currentX = _dragX ?? defaultLeft;
                final currentY = _dragY ?? defaultTop;
                
                // Snap X to left or right edge
                if (currentX + (minWidth / 2) > screenWidth / 2) {
                  _dragX = screenWidth - minWidth - 20;
                } else {
                  _dragX = 20;
                }
                
                // Keep Y within safe area
                if (currentY < paddingTop + 20) {
                  _dragY = paddingTop + 20;
                } else if (currentY > screenHeight - minHeight - 20 - paddingBottom) {
                  _dragY = screenHeight - minHeight - 20 - paddingBottom;
                }
              });
            } : null,
            child: Material(
              elevation: isMinimized ? 12 : 0,
              color: Colors.black,
              borderRadius: BorderRadius.circular(isMinimized ? 12 : 0),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  playerWidget,
                  if (isMinimized && !isOsPipMode)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: GestureDetector(
                        onTap: () {
                          context.read<MiniPlayerCubit>().dismiss();
                        },
                        child: Container(
                          decoration: const BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                          ),
                          padding: const EdgeInsets.all(4),
                          child: const Icon(Icons.close, color: Colors.white, size: 18),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
