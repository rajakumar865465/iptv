import 'dart:convert';
import 'dart:developer' as developer;
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
  final List<LanguageModel> languages;
  final bool hasMore;
  final bool isLoadingMore;
  final String? error;
  final bool workingOnly;
  final int totalCount;

  ChannelLoaded(
    this.channels,
    this.categories,
    this.languages, {
    this.hasMore = false,
    this.isLoadingMore = false,
    this.error,
    this.workingOnly = true,
    this.totalCount = 0,
  });
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
  List<LanguageModel> _allLanguages = [];

  int _currentPage = 1;
  bool _hasMore = true;
  int _totalCount = 0;
  String _currentQuery = '';
  bool _workingOnly = true;

  // Use categoryId for exact server-side matching
  int? _filterCategoryId;
  String? _filterCategoryName;
  String? _filterLanguage;

  // Getters for UI
  int? get filterCategoryId => _filterCategoryId;
  String? get filterCategoryName => _filterCategoryName;
  String? get filterLanguage => _filterLanguage;
  bool get workingOnly => _workingOnly;

  Future<void> loadChannels({
    bool isRefresh = false,
    String? query,
    bool? workingOnly,
    // Accept categoryId (int) for exact match OR categoryName (String) for backwards compat
    int? categoryId,
    String? categoryName,
    String? language,
  }) async {
    if (isRefresh) {
      _currentPage = 1;
      _hasMore = true;
      _totalCount = 0;
      _allChannels.clear();
      if (workingOnly != null && _workingOnly != workingOnly) {
        _allCategories.clear();
        _allLanguages.clear();
      }
      emit(ChannelLoading());
    } else {
      if (!_hasMore) return;
      if (state is ChannelLoaded) {
        final s = state as ChannelLoaded;
        emit(ChannelLoaded(
          _allChannels, _allCategories, _allLanguages,
          hasMore: _hasMore, isLoadingMore: true,
          workingOnly: _workingOnly, totalCount: _totalCount,
        ));
      }
    }

    if (query != null) _currentQuery = query;
    if (workingOnly != null) _workingOnly = workingOnly;

    // Category: prefer id over name
    if (categoryId != null) {
      _filterCategoryId = categoryId == 0 ? null : categoryId;
    }
    if (categoryName != null) {
      _filterCategoryName = categoryName.isEmpty ? null : categoryName;
      // If we have categories loaded, resolve name → id
      if (_filterCategoryName != null && _allCategories.isNotEmpty) {
        final match = _allCategories
            .where((c) => c.name.toLowerCase() == _filterCategoryName!.toLowerCase())
            .firstOrNull;
        if (match != null) _filterCategoryId = match.id;
      }
    }

    if (language != null) {
      _filterLanguage = language.isEmpty ? null : language;
    }

    // Debug log
    developer.log(
      '[ChannelCubit] loadChannels\n'
      '  categoryId: $_filterCategoryId\n'
      '  categoryName: $_filterCategoryName\n'
      '  language: $_filterLanguage\n'
      '  workingOnly: $_workingOnly\n'
      '  search: $_currentQuery\n'
      '  page: $_currentPage',
      name: 'ChannelCubit',
    );

    try {
      final params = <String, dynamic>{
        'page': _currentPage,
        'limit': 50,
      };

      if (_currentQuery.isNotEmpty) params['search'] = _currentQuery;
      if (_filterCategoryId != null) params['categoryId'] = _filterCategoryId.toString();
      if (_filterLanguage != null) params['language'] = _filterLanguage;
      if (_workingOnly) {
        params['workingOnly'] = 'true';
      } else {
        params['showOffline'] = 'true';
      }

      developer.log(
        '[ChannelCubit] API call: ${ApiEndpoints.channelList} params=$params',
        name: 'ChannelCubit',
      );

      // Load channels + categories + languages in parallel on first page
      final Future<Map<String, dynamic>> channelFuture =
          _api.get(ApiEndpoints.channelList, queryParameters: params);

      Future<Map<String, dynamic>>? catFuture;
      Future<Map<String, dynamic>>? langFuture;

      if (_allCategories.isEmpty) {
        catFuture = _api.get(
          ApiEndpoints.categoryList,
          queryParameters: {'workingOnly': _workingOnly ? 'true' : 'false'},
        );
      }
      if (_allLanguages.isEmpty) {
        langFuture = _api.get(
          ApiEndpoints.languageList,
          queryParameters: {'workingOnly': _workingOnly ? 'true' : 'false'},
        );
      }

      final channelRes = await channelFuture;
      if (catFuture != null) {
        try {
          final catRes = await catFuture;
          if (catRes['success'] == true) {
            _allCategories = (catRes['data'] as List)
                .map((c) => CategoryModel.fromJson(c))
                .toList();
          }
        } catch (e) {
          developer.log('[ChannelCubit] Error loading categories: $e', name: 'ChannelCubit');
        }
      }
      if (langFuture != null) {
        try {
          final langRes = await langFuture;
          if (langRes['success'] == true) {
            _allLanguages = (langRes['data'] as List)
                .map((l) => LanguageModel.fromJson(l))
                .toList();
          }
        } catch (e) {
          developer.log('[ChannelCubit] Error loading languages: $e', name: 'ChannelCubit');
        }
      }

      if (channelRes['success'] == true) {
        final newChannels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();

        _allChannels.addAll(newChannels);
        _allChannels = _deduplicateChannels(_allChannels);

        final pagination = channelRes['pagination'];
        if (pagination != null) {
          _hasMore = pagination['hasMore'] ?? false;
          _totalCount = pagination['total'] ?? _allChannels.length;
        } else {
          _hasMore = false;
          _totalCount = _allChannels.length;
        }

        developer.log(
          '[ChannelCubit] Loaded ${newChannels.length} channels (total=${_allChannels.length}, hasMore=$_hasMore, serverTotal=$_totalCount)',
          name: 'ChannelCubit',
        );
        if (newChannels.isNotEmpty) {
          developer.log(
            '[ChannelCubit] Sample:\n' +
                newChannels.take(10).map((c) =>
                  '  ${c.name} | cat=${c.categoryName}(${c.categoryId}) | lang=${c.language} | health=${c.healthStatus}'
                ).join('\n'),
            name: 'ChannelCubit',
          );
        }

        _currentPage++;

        // Cache first page of unfiltered standard load
        if (_currentPage == 2 && _currentQuery.isEmpty &&
            _filterCategoryId == null && _filterLanguage == null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(StorageKeys.cachedChannels, jsonEncode(channelRes['data']));
          await prefs.setString(StorageKeys.cachedCategories, jsonEncode(
            _allCategories.map((c) => {
              'id': c.id, 'name': c.name, 'icon_url': c.iconUrl,
              'status': c.status, 'sort_order': c.sortOrder, 'channel_count': c.channelCount,
            }).toList()
          ));
          await prefs.setInt('cache_timestamp', DateTime.now().millisecondsSinceEpoch);
        }

        emit(ChannelLoaded(
          List.from(_allChannels),
          _allCategories,
          _allLanguages,
          hasMore: _hasMore,
          isLoadingMore: false,
          workingOnly: _workingOnly,
          totalCount: _totalCount,
        ));
      } else {
        await _handleLoadError('Failed to load channels from server');
      }
    } catch (e) {
      developer.log('[ChannelCubit] Error: $e', name: 'ChannelCubit');
      await _handleLoadError('Unable to load channels. Please check connection and try again.');
    }
  }

  Future<void> _handleLoadError(String message) async {
    if (_allChannels.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final cachedChannelsStr = prefs.getString(StorageKeys.cachedChannels);
        final cachedCatsStr = prefs.getString(StorageKeys.cachedCategories);
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
      } catch (_) {}
    }

    if (_allChannels.isNotEmpty) {
      emit(ChannelLoaded(
        List.from(_allChannels),
        _allCategories,
        _allLanguages,
        hasMore: _hasMore,
        isLoadingMore: false,
        workingOnly: _workingOnly,
        totalCount: _totalCount,
        error: message,
      ));
    } else {
      emit(ChannelError(message));
    }
  }

  Future<void> loadFeaturedChannels() async {
    emit(ChannelLoading());
    try {
      final channelRes = await _api.get(ApiEndpoints.channelList, queryParameters: {'featured': 'true', 'limit': '20'});
      if (_allCategories.isEmpty) {
        try {
          final catRes = await _api.get(ApiEndpoints.categoryList);
          if (catRes['success'] == true) {
            _allCategories = (catRes['data'] as List)
                .map((c) => CategoryModel.fromJson(c))
                .toList();
          }
        } catch (e) {
          developer.log('[ChannelCubit] Error loading categories for featured: $e', name: 'ChannelCubit');
        }
      }
      if (channelRes['success'] == true) {
        final channels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(channels, _allCategories, _allLanguages));
      } else {
        emit(ChannelError('Failed to load channels'));
      }
    } catch (e) {
      emit(ChannelError('Error loading featured channels'));
    }
  }

  Future<void> loadPopularChannels() async {
    await loadFeaturedChannels();
  }

  Future<void> searchChannels(String query) async {
    await loadChannels(isRefresh: true, query: query);
  }

  List<ChannelModel> get allChannels => _allChannels;

  List<ChannelModel> _deduplicateChannels(List<ChannelModel> channels) {
    final seen = <String, ChannelModel>{};
    for (final ch in channels) {
      final key = '${_canonical(ch.name)}|${(ch.language ?? '').toLowerCase()}|${ch.categoryId ?? 0}';
      final existing = seen[key];
      if (existing == null) {
        seen[key] = ch;
      } else {
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
