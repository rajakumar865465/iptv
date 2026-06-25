import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../models/channel_model.dart';
import '../constants.dart';

abstract class ChannelState {}

class ChannelInitial extends ChannelState {}
class ChannelLoading extends ChannelState {}
class ChannelLoaded extends ChannelState {
  final List<ChannelModel> channels;
  final List<CategoryModel> categories;
  final bool hasMore;
  final bool isLoadingMore;
  final String? error;

  ChannelLoaded(this.channels, this.categories, {this.hasMore = false, this.isLoadingMore = false, this.error});
}
class ChannelError extends ChannelState {
  final String message;
  ChannelError(this.message);
}

class ChannelCubit extends Cubit<ChannelState> {
  ChannelCubit() : super(ChannelInitial());

  final ApiService _api = ApiService();
  List<ChannelModel> _allChannels = [];
  List<CategoryModel> _allCategories = [];

  int _currentPage = 1;
  bool _hasMore = true;
  String _currentQuery = '';
  bool _workingOnly = true;
  // Server-side filters — send to API, no client-side post-filter needed
  String? _filterCategory;
  String? _filterLanguage;

  Future<void> loadChannels({
    bool isRefresh = false,
    String? query,
    bool? workingOnly,
    String? category,   // sends ?category= to server (Part 7)
    String? language,   // sends ?language= to server (Part 7)
  }) async {
    if (isRefresh) {
      _currentPage = 1;
      _hasMore = true;
      _allChannels.clear();
      emit(ChannelLoading());
    } else {
      if (!_hasMore) return;
      if (state is ChannelLoaded) {
        emit(ChannelLoaded(_allChannels, _allCategories, hasMore: _hasMore, isLoadingMore: true));
      }
    }

    if (query    != null) _currentQuery    = query;
    if (workingOnly != null) _workingOnly  = workingOnly;
    // Allow explicit null to clear filter via named arg
    if (category != null) _filterCategory = category == '' ? null : category;
    if (language != null) _filterLanguage = language == '' ? null : language;

    try {
      final params = <String, dynamic>{
        'page':  _currentPage,
        'limit': 50,
      };

      if (_currentQuery.isNotEmpty)    params['search']   = _currentQuery;
      if (_filterCategory != null)     params['category'] = _filterCategory;
      if (_filterLanguage != null)     params['language'] = _filterLanguage;
      if (_workingOnly)  params['workingOnly']  = 'true';
      else               params['showOffline']  = 'true';

      final channelRes = await _api.get(ApiEndpoints.channelList, queryParameters: params);

      Map<String, dynamic>? catRes;
      if (_allCategories.isEmpty) {
        catRes = await _api.get(ApiEndpoints.categoryList);
        if (catRes['success'] == true) {
          _allCategories = (catRes['data'] as List)
              .map((c) => CategoryModel.fromJson(c))
              .toList();
        }
      }

      if (channelRes['success'] == true) {
        final newChannels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();

        // Flutter-side dedup safety net: deduplicate by canonical name + language + category.
        // The backend is the primary source of truth, but this guards against any regression.
        _allChannels.addAll(newChannels);
        _allChannels = _deduplicateChannels(_allChannels);
        
        final pagination = channelRes['pagination'];
        if (pagination != null) {
          _hasMore = pagination['hasMore'] ?? false;
        } else {
          _hasMore = false;
        }

        _currentPage++;
        
        // Cache if this is the first page of standard load
        // Fix #28: Include a timestamp so stale cache (>6h) can be detected
        if (_currentPage == 2 && _currentQuery.isEmpty) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(StorageKeys.cachedChannels, jsonEncode(channelRes['data']));
          await prefs.setString(StorageKeys.cachedCategories, jsonEncode(catRes?['data'] ?? []));
          await prefs.setInt('cache_timestamp', DateTime.now().millisecondsSinceEpoch);
        }

        emit(ChannelLoaded(List.from(_allChannels), _allCategories, hasMore: _hasMore, isLoadingMore: false));
      } else {
        await _handleLoadError('Failed to load channels from server');
      }
    } catch (e) {
      await _handleLoadError('Unable to load channels. Please check connection and try again.');
    }
  }

  Future<void> _handleLoadError(String message) async {
    if (_allChannels.isEmpty) {
      // Try to load from cache
      try {
        final prefs = await SharedPreferences.getInstance();
        final cachedChannelsStr = prefs.getString(StorageKeys.cachedChannels);
        final cachedCatsStr = prefs.getString(StorageKeys.cachedCategories);
        // Fix #28: Respect cache expiry — ignore cache older than 6 hours
        final cacheTimestamp = prefs.getInt('cache_timestamp') ?? 0;
        final cacheAge = DateTime.now().millisecondsSinceEpoch - cacheTimestamp;
        final cacheValid = cacheAge < const Duration(hours: 6).inMilliseconds;

        if (cacheValid && cachedChannelsStr != null && cachedChannelsStr.isNotEmpty) {
          final channelsList = jsonDecode(cachedChannelsStr) as List;
          _allChannels = channelsList.map((c) => ChannelModel.fromJson(c)).toList();
        }
        if (cacheValid && cachedCatsStr != null && cachedCatsStr.isNotEmpty) {
          final catsList = jsonDecode(cachedCatsStr) as List;
          _allCategories = catsList.map((c) => CategoryModel.fromJson(c)).toList();
        }
      } catch (e) {
        // Cache read failed
      }
    }

    if (_allChannels.isNotEmpty) {
      emit(ChannelLoaded(List.from(_allChannels), _allCategories, hasMore: _hasMore, isLoadingMore: false, error: message));
    } else {
      emit(ChannelError(message));
    }
  }

  Future<void> loadFeaturedChannels() async {
    // Basic implementation for compatibility
    emit(ChannelLoading());
    try {
      // Fix #12: Use queryParameters instead of embedding ?featured=true in the URL string
      final channelRes = await _api.get(ApiEndpoints.channelList, queryParameters: {'featured': 'true'});
      if (_allCategories.isEmpty) {
        final catRes = await _api.get(ApiEndpoints.categoryList);
        if (catRes['success'] == true) {
          _allCategories = (catRes['data'] as List)
              .map((c) => CategoryModel.fromJson(c))
              .toList();
        }
      }

      if (channelRes['success'] == true) {
        final channels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(channels, _allCategories));
      } else {
        emit(ChannelError('Failed to load channels'));
      }
    } catch (e) {
      emit(ChannelError('Error loading featured channels'));
    }
  }

  Future<void> loadPopularChannels() async {
    // Basic implementation for compatibility
    await loadFeaturedChannels();
  }

  Future<void> searchChannels(String query) async {
    await loadChannels(isRefresh: true, query: query);
  }

  List<ChannelModel> get allChannels => _allChannels;

  // Flutter-side dedup: keeps one channel per (canonicalName + language + categoryId).
  // Prefers channels with streamUrl set and online health status.
  List<ChannelModel> _deduplicateChannels(List<ChannelModel> channels) {
    final seen = <String, ChannelModel>{};
    for (final ch in channels) {
      final key = '${_canonical(ch.name)}|${(ch.language ?? '').toLowerCase()}|${ch.categoryId ?? 0}';
      final existing = seen[key];
      if (existing == null) {
        seen[key] = ch;
      } else {
        // Keep the one with a stream URL; prefer the existing one already in map
        if (ch.streamUrl.isNotEmpty && existing.streamUrl.isEmpty) {
          seen[key] = ch;
        }
      }
    }
    return seen.values.toList();
  }

  String _canonical(String name) {
    return name
        .toLowerCase()
        .replaceAll(RegExp(r'\s*\([^)]*\)\s*'), ' ')
        .replaceAll(RegExp(r'\s*(hd|sd|fhd|uhd|4k)\s*', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s*(1080p?|720p?|576p?|480p?|360p?)\s*', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s*(backup|live|channel|source\s*\d*)\s*', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  List<ChannelModel> getFeaturedChannels() {
    return _allChannels.where((c) => c.isFeatured).toList();
  }

  List<ChannelModel> getChannelsByCategory(int categoryId) {
    return _allChannels.where((c) => c.categoryId == categoryId).toList();
  }
}
