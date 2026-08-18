import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../models/channel_model.dart';
import '../screens/player_screen.dart'; // To get PlayerSourceType and ChannelSourceFilters

enum MiniPlayerStateEnum { hidden, fullscreen, minimized }

class MiniPlayerState extends Equatable {
  final MiniPlayerStateEnum state;
  final ChannelModel? channel;
  final List<ChannelModel> contextChannels;
  final int initialIndex;
  final PlayerSourceType sourceType;
  final ChannelSourceFilters sourceFilters;
  
  // OS PiP state
  final bool isOsPipMode;

  const MiniPlayerState({
    this.state = MiniPlayerStateEnum.hidden,
    this.channel,
    this.contextChannels = const [],
    this.initialIndex = 0,
    this.sourceType = PlayerSourceType.homeFeatured,
    this.sourceFilters = const ChannelSourceFilters(),
    this.isOsPipMode = false,
  });

  MiniPlayerState copyWith({
    MiniPlayerStateEnum? state,
    ChannelModel? channel,
    List<ChannelModel>? contextChannels,
    int? initialIndex,
    PlayerSourceType? sourceType,
    ChannelSourceFilters? sourceFilters,
    bool? isOsPipMode,
  }) {
    return MiniPlayerState(
      state: state ?? this.state,
      channel: channel ?? this.channel,
      contextChannels: contextChannels ?? this.contextChannels,
      initialIndex: initialIndex ?? this.initialIndex,
      sourceType: sourceType ?? this.sourceType,
      sourceFilters: sourceFilters ?? this.sourceFilters,
      isOsPipMode: isOsPipMode ?? this.isOsPipMode,
    );
  }

  @override
  List<Object?> get props => [state, channel, contextChannels, initialIndex, sourceType, sourceFilters, isOsPipMode];
}

class MiniPlayerCubit extends Cubit<MiniPlayerState> {
  static const MethodChannel _channel = MethodChannel('com.iptv.iptv_app/pip');

  MiniPlayerCubit() : super(const MiniPlayerState()) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onPipChanged') {
        final isPip = call.arguments as bool;
        setOsPipMode(isPip);
      }
    });
  }

  void _updateNativePipState(bool allowed) {
    try {
      _channel.invokeMethod('setPipAllowed', allowed);
    } catch (e) {
      // Ignore if not on Android
    }
  }

  void play(
    ChannelModel channel, {
    List<ChannelModel>? contextChannels,
    int initialIndex = 0,
    PlayerSourceType sourceType = PlayerSourceType.homeFeatured,
    ChannelSourceFilters sourceFilters = const ChannelSourceFilters(),
  }) {
    emit(state.copyWith(
      state: MiniPlayerStateEnum.fullscreen,
      channel: channel,
      contextChannels: contextChannels ?? [channel],
      initialIndex: initialIndex,
      sourceType: sourceType,
      sourceFilters: sourceFilters,
    ));
    _updateNativePipState(true);
  }

  void minimize() {
    if (state.channel != null) {
      emit(state.copyWith(state: MiniPlayerStateEnum.minimized));
      _updateNativePipState(true);
    }
  }

  void expand() {
    if (state.channel != null) {
      emit(state.copyWith(state: MiniPlayerStateEnum.fullscreen));
      _updateNativePipState(true);
    }
  }

  void dismiss() {
    emit(state.copyWith(state: MiniPlayerStateEnum.hidden));
    _updateNativePipState(false);
  }
  
  void setOsPipMode(bool isOsPipMode) {
    if (state.isOsPipMode && !isOsPipMode) {
      // Returning from OS PiP -> auto-expand to fullscreen like professional apps
      emit(state.copyWith(
        isOsPipMode: false,
        state: MiniPlayerStateEnum.fullscreen,
      ));
    } else {
      emit(state.copyWith(isOsPipMode: isOsPipMode));
    }
  }
}
