import 'dart:developer' as developer;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/api_service.dart';
import '../models/channel_model.dart';
import '../constants.dart';

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
        final data = res['data'] as Map<String, dynamic>;

        final continueWatching = _parseChannels(data['continue_watching']);
        final premiumChannels  = _parseChannels(data['premium_channels']);
        final popularChannels  = _parseChannels(data['popular_channels']);
        final featuredChannels = _parseChannels(data['featured_channels']);

        final rawCategories = (data['categories'] as List? ?? []);
        final categories = rawCategories
            .map((c) => HomeCategorySection.fromJson(c))
            .where((s) => s.channels.isNotEmpty)
            .toList();

        developer.log(
          '[HomeCubit] Loaded home:\n'
          '  continueWatching=${continueWatching.length}\n'
          '  premium=${premiumChannels.length}\n'
          '  popular=${popularChannels.length}\n'
          '  featured=${featuredChannels.length}\n'
          '  categories=${categories.length}',
          name: 'HomeCubit',
        );

        emit(HomeLoaded(
          continueWatching: continueWatching,
          premiumChannels: premiumChannels,
          popularChannels: popularChannels,
          featuredChannels: featuredChannels,
          categories: categories,
        ));
      } else {
        emit(HomeError('Failed to load home data from server'));
      }
    } catch (e) {
      developer.log('[HomeCubit] Error: $e', name: 'HomeCubit');
      emit(HomeError('Unable to load home. Please check your connection.'));
    }
  }

  List<ChannelModel> _parseChannels(dynamic raw) {
    if (raw == null) return const [];
    if (raw is! List) return const [];
    return raw.map((c) => ChannelModel.fromJson(c as Map<String, dynamic>)).toList();
  }
}
