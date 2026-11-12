import 'dart:developer' as developer;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/channel_model.dart';
import '../constants.dart';
import '../utils/force_update_helper.dart';

// ─── States ───────────────────────────────────────────────────────────────────

abstract class HomeState {}

class HomeInitial extends HomeState {}

class HomeLoading extends HomeState {}

class HomeLoaded extends HomeState {
  final List<ChannelModel> continueWatching;
  final List<ChannelModel> premiumChannels;
  final List<ChannelModel> popularChannels;
  final List<ChannelModel> featuredChannels;
  final List<HomeCategorySection> categories;
  final String? error; // non-null if loaded from cache after API failure

  HomeLoaded({
    this.continueWatching = const [],
    this.premiumChannels = const [],
    this.popularChannels = const [],
    this.featuredChannels = const [],
    this.categories = const [],
    this.error,
  });

  /// All unique channels across all sections (for player navigation)
  List<ChannelModel> get allChannels {
    final seen = <int>{};
    final result = <ChannelModel>[];
    void add(ChannelModel c) {
      if (seen.add(c.id)) result.add(c);
    }
    for (final c in featuredChannels) add(c);
    for (final c in premiumChannels) add(c);
    for (final c in popularChannels) add(c);
    for (final c in continueWatching) add(c);
    for (final section in categories) {
      for (final c in section.channels) add(c);
    }
    return result;
  }

  bool get hasAnyContent =>
      continueWatching.isNotEmpty ||
      premiumChannels.isNotEmpty ||
      popularChannels.isNotEmpty ||
      featuredChannels.isNotEmpty ||
      categories.isNotEmpty;
}

class HomeForceUpdateRequired extends HomeState {
  final ForceUpdateInfo? info;
  HomeForceUpdateRequired([this.info]);
}

class HomeError extends HomeState {
  final String message;
  HomeError(this.message);
}

// ─── Cubit ────────────────────────────────────────────────────────────────────

class HomeCubit extends Cubit<HomeState> {
  HomeCubit() : super(HomeInitial());

  final ApiService _api = ApiService();

  /// Load the home page data from /api/home
  Future<void> loadHome({bool isRefresh = false}) async {
    if (!isRefresh && state is HomeLoaded) return; // already loaded
    emit(HomeLoading());

    try {
      final res = await _api.get(ApiEndpoints.home);

      if (res['success'] == true) {
        final rawData = res['data'];
        if (rawData is! Map<String, dynamic>) {
          if (isClosed) return;
          emit(HomeError('Invalid response format from server'));
          return;
        }
        final data = rawData;

        final serverContinueWatching = _parseChannels(data['continue_watching']);
        final localContinueWatching = await StorageService().getWatchHistory();
        
        // Merge or just use local if preferred.
        final continueWatching = localContinueWatching.isNotEmpty 
            ? localContinueWatching 
            : serverContinueWatching;

        final premiumChannels  = _parseChannels(data['premium_channels']);
        final popularChannels  = _parseChannels(data['popular_channels']);
        final featuredChannels = _parseChannels(data['featured_channels']);

        final rawCategories = (data['categories'] as List? ?? []);
        final categories = rawCategories
            .map((c) => HomeCategorySection.fromJson(c))
            .map((s) => HomeCategorySection(
                  id: s.id,
                  name: s.name,
                  iconUrl: s.iconUrl,
                  sortOrder: s.sortOrder,
                  channelCount: s.channelCount,
                  channels: _deduplicate(s.channels),
                ))
            .where((s) => s.channels.isNotEmpty)
            .toList();

        developer.log(
          '[HomeCubit] Loaded home:\n'
          '  continueWatching=${continueWatching.length} (local: ${localContinueWatching.length})\n'
          '  premium=${premiumChannels.length}\n'
          '  popular=${popularChannels.length}\n'
          '  featured=${featuredChannels.length}\n'
          '  categories=${categories.length}',
          name: 'HomeCubit',
        );
        if (isClosed) return;

        emit(HomeLoaded(
          continueWatching: continueWatching,
          premiumChannels: premiumChannels,
          popularChannels: popularChannels,
          featuredChannels: featuredChannels,
          categories: categories,
        ));
      } else {
        if (isClosed) return;
        emit(HomeError('Failed to load home data from server'));
      }
    } catch (e) {
      developer.log('[HomeCubit] Error: $e', name: 'HomeCubit');
      if (isClosed) return;
      if (ForceUpdateHelper.isForceUpdateException(e)) {
        emit(HomeForceUpdateRequired(ForceUpdateHelper.extractInfo(e)));
        return;
      }
      emit(HomeError('Unable to load home. Please check your connection.'));
    }
  }

  List<ChannelModel> _parseChannels(dynamic raw) {
    if (raw == null) return const [];
    if (raw is! List) return const [];
    final list = raw
        .map((c) => ChannelModel.fromJson(c as Map<String, dynamic>))
        .where((c) => c.isPlayable)
        .toList();
    return _deduplicate(list);
  }

  static List<ChannelModel> _deduplicate(List<ChannelModel> channels) {
    final seen = <String, ChannelModel>{};
    for (final ch in channels) {
      final key = _canonical(ch.name);
      final existing = seen[key];
      if (existing == null) {
        seen[key] = ch;
      } else {
        final existingScore = _channelScore(existing);
        final chScore = _channelScore(ch);
        if (chScore > existingScore) {
          seen[key] = ch;
        }
      }
    }
    return seen.values.toList();
  }

  static int _channelScore(ChannelModel ch) {
    int score = _qualityRank(ch) * 100;
    final lang = (ch.language ?? '').toLowerCase();
    if (lang == 'hindi') {
      score += 50;
    } else if (lang == 'english') {
      score += 40;
    } else if (lang == 'bengali' || lang == 'tamil' || lang == 'telugu') {
      score += 30;
    }
    if (ch.streamUrl.isNotEmpty) score += 20;
    score += (ch.popularityScore > 0 ? (ch.popularityScore > 50 ? 50 : ch.popularityScore) : 0);
    return score;
  }

  static int _qualityRank(ChannelModel ch) {
    final q = ch.qualityLabel;
    if (q == '4K') return 5;
    if (q == 'FHD') return 4;
    if (q == 'HD') return 3;
    if (q == 'SD') return 2;
    if (q == '360p') return 1;
    return 0;
  }

  static String _canonical(String name) {
    return name
        .toLowerCase()
        .replaceAll(RegExp(r'\s*[\(\[][^\)\]]*[\)\]]\s*'), ' ')
        .replaceAll(RegExp(r'\b(apac|asia|in|india|backup|live|feed)\b', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s*(hd|sd|fhd|uhd|4k)\s*', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s*(1080p?|720p?|576p?|480p?|360p?)\s*', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s*(backup|live|channel|source\s*\d*)\s*', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }
}
