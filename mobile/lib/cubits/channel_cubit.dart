import 'dart:convert';
import 'dart:developer' as developer;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../models/channel_model.dart';
import '../constants.dart';
import '../utils/force_update_helper.dart';

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

class ChannelForceUpdateRequired extends ChannelState {
  final ForceUpdateInfo? info;
  ChannelForceUpdateRequired([this.info]);
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
  String? _genreFilter;   // coarse 9-genre facet (News, Movies, …)
  String? _countryFilter; // country code / name substring
  String? _qualityFilter; // hd | sd | 4k
  String _sortBy = 'recommended'; // recommended | popular | premium | az | recent | quality | stable | number | watched | updated
  String _premiumFilter = 'all'; // all | true | false
  String? _tierFilter; // null | 'free' | 'pro' | 'plus'

  // Track what filter was active when chips were last loaded so we know when to reload them
  int? _chipsLoadedForCategoryId;  // category used when language chips were last fetched
  String? _chipsLoadedForLanguage; // language used when category chips were last fetched

  // Getters for UI
  int? get filterCategoryId => _filterCategoryId;
  String? get filterCategoryName => _filterCategoryName;
  String? get filterLanguage => _filterLanguage;
  String? get genreFilter => _genreFilter;
  String? get countryFilter => _countryFilter;
  String? get qualityFilter => _qualityFilter;
  String get sortBy => _sortBy;
  String get premiumFilter => _premiumFilter;
  String? get tierFilter => _tierFilter;
  bool get workingOnly => _workingOnly;
  String get currentQuery => _currentQuery;

  /// True when any directory facet (beyond search) is narrowing the list.
  bool get hasActiveFilters =>
      _filterCategoryId != null ||
      _filterLanguage != null ||
      _genreFilter != null ||
      _countryFilter != null ||
      _qualityFilter != null ||
      _premiumFilter != 'all' ||
      _tierFilter != null;

  /// Clear all directory filters so search or directory returns to full catalog.
  void clearFilters() {
    _filterCategoryId = null;
    _filterCategoryName = null;
    _filterLanguage = null;
    _genreFilter = null;
    _countryFilter = null;
    _qualityFilter = null;
    _premiumFilter = 'all';
    _tierFilter = null;
    _sortBy = 'recommended';
  }

  Future<void> loadChannels({
    bool isRefresh = false,
    String? query,
    bool? workingOnly,
    // Accept categoryId (int) for exact match OR categoryName (String) for backwards compat
    int? categoryId,
    String? categoryName,
    String? language,
    String? genre,
    String? country,
    String? quality,
    String? sortBy,
    String? premiumFilter,
    String? tierFilter,
    // When false, omit page/limit so the server returns the FULL filtered set in
    // one response — used by the Live TV directory to build A–Z / quick sections.
    bool paginate = true,
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
    if (genre != null) {
      _genreFilter = genre.isEmpty ? null : genre;
    }
    if (country != null) {
      _countryFilter = country.isEmpty ? null : country;
    }
    if (quality != null) {
      _qualityFilter = quality.isEmpty ? null : quality;
    }

    if (sortBy != null) _sortBy = sortBy;
    if (premiumFilter != null) _premiumFilter = premiumFilter;
    if (tierFilter != null) {
      final cleanTier = tierFilter.trim().toLowerCase();
      _tierFilter = (cleanTier.isEmpty || cleanTier == 'all') ? null : cleanTier;
    }

    // When category filter changes, language chip counts must be reloaded for that category.
    // When language filter changes, category chip counts must be reloaded for that language.
    if (isRefresh && _filterCategoryId != _chipsLoadedForCategoryId) {
      _allLanguages.clear();
    }
    if (isRefresh && _filterLanguage != _chipsLoadedForLanguage) {
      _allCategories.clear();
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
      final params = <String, dynamic>{};
      // Omit page/limit when not paginating → backend returns the full filtered set.
      if (paginate) {
        params['page'] = _currentPage;
        params['limit'] = 50;
      }

      if (_currentQuery.isNotEmpty) params['search'] = _currentQuery;
      if (_filterCategoryId != null) params['categoryId'] = _filterCategoryId.toString();
      if (_filterLanguage != null) params['language'] = _filterLanguage;
      if (_genreFilter != null) params['genre'] = _genreFilter;
      if (_countryFilter != null) params['country'] = _countryFilter;
      if (_qualityFilter != null) params['quality'] = _qualityFilter;
      if (_workingOnly) {
        params['workingOnly'] = 'true';
      } else {
        params['showOffline'] = 'true';
      }
      if (_sortBy != 'recommended') params['sort'] = _sortBy;
      if (_premiumFilter != 'all') params['premium'] = _premiumFilter;
      if (_tierFilter != null) params['tier'] = _tierFilter;

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
        final catParams = <String, dynamic>{'workingOnly': _workingOnly ? 'true' : 'false'};
        if (_filterLanguage != null) catParams['language'] = _filterLanguage!;
        catFuture = _api.get(ApiEndpoints.categoryList, queryParameters: catParams);
      }
      if (_allLanguages.isEmpty) {
        final langParams = <String, dynamic>{'workingOnly': _workingOnly ? 'true' : 'false'};
        if (_filterCategoryId != null) langParams['categoryId'] = _filterCategoryId.toString();
        langFuture = _api.get(ApiEndpoints.languageList, queryParameters: langParams);
      }

      final channelRes = await channelFuture;
      if (catFuture != null) {
        try {
          final catRes = await catFuture;
          if (catRes['success'] == true) {
            _allCategories = (catRes['data'] as List)
                .map((c) => CategoryModel.fromJson(c))
                .toList();
            _chipsLoadedForLanguage = _filterLanguage;
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
            _chipsLoadedForCategoryId = _filterCategoryId;
          }
        } catch (e) {
          developer.log('[ChannelCubit] Error loading languages: $e', name: 'ChannelCubit');
        }
      }
      if (isClosed) return;

      if (channelRes['success'] == true) {
        final newChannels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();

        if (_workingOnly) {
          newChannels.removeWhere((c) => !c.isPlayable);
        }

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
        if (isClosed) return;

        // Cache first page of unfiltered standard load
        if (_currentPage == 2 && _currentQuery.isEmpty &&
            _filterCategoryId == null && _filterLanguage == null &&
            _genreFilter == null && _countryFilter == null &&
            _qualityFilter == null && _premiumFilter == 'all' &&
            _tierFilter == null) {
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

        if (isClosed) return;
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
        if (isClosed) return;
        await _handleLoadError('Failed to load channels from server');
      }
    } catch (e) {
      developer.log('[ChannelCubit] Error: $e', name: 'ChannelCubit');
      if (isClosed) return;
      if (ForceUpdateHelper.isForceUpdateException(e)) {
        emit(ChannelForceUpdateRequired(ForceUpdateHelper.extractInfo(e)));
        return;
      }
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

    if (isClosed) return;
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
        if (isClosed) return;
        emit(ChannelLoaded(channels, _allCategories, _allLanguages));
      } else {
        if (isClosed) return;
        emit(ChannelError('Failed to load channels'));
      }
    } catch (e) {
      if (isClosed) return;
      if (ForceUpdateHelper.isForceUpdateException(e)) {
        emit(ChannelForceUpdateRequired(ForceUpdateHelper.extractInfo(e)));
        return;
      }
      emit(ChannelError('Error loading featured channels'));
    }
  }

  Future<void> loadPopularChannels() async {
    await loadFeaturedChannels();
  }

  Future<void> searchChannels(String query, {bool resetFilters = true}) async {
    if (resetFilters) {
      clearFilters();
    }
    await loadChannels(
      isRefresh: true,
      query: query,
      categoryId: 0,
      categoryName: '',
      language: '',
      genre: '',
      country: '',
      quality: '',
      premiumFilter: 'all',
      tierFilter: '',
      sortBy: 'recommended',
    );
  }

  List<ChannelModel> get allChannels => _allChannels;

  // Keyed on the canonical name only (not language) so regional variants of the
  // same channel — e.g. Hindi and Urdu "Cartoon Network" feeds — collapse to a
  // single card. Ties are resolved by _channelScore, so the best feed wins.
  List<ChannelModel> _deduplicateChannels(List<ChannelModel> channels) {
    final seen = <String, ChannelModel>{};
    for (final ch in channels) {
      final key = _canonical(ch.name);
      final existing = seen[key];
      if (existing == null) {
        seen[key] = ch;
      } else if (_channelScore(ch) > _channelScore(existing)) {
        seen[key] = ch;
      }
    }
    return seen.values.toList();
  }

  int _qualityRankOf(ChannelModel ch) {
    switch (ch.qualityLabel) {
      case '4K':
        return 5;
      case 'FHD':
        return 4;
      case 'HD':
        return 3;
      case 'SD':
        return 2;
      case '360p':
        return 1;
      default:
        return 0;
    }
  }

  int _channelScore(ChannelModel ch) {
    int score = _qualityRankOf(ch) * 100;
    final lang = (ch.language ?? '').toLowerCase();
    if (lang == 'hindi') {
      score += 50;
    } else if (lang == 'english') {
      score += 40;
    } else if (lang == 'bengali' || lang == 'tamil' || lang == 'telugu') {
      score += 30;
    }
    if (ch.streamUrl.isNotEmpty) score += 20;
    if (ch.popularityScore > 0) {
      score += ch.popularityScore > 50 ? 50 : ch.popularityScore;
    }
    return score;
  }

  String _canonical(String name) {
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

  List<ChannelModel> getFeaturedChannels() {
    return _allChannels.where((c) => c.isFeatured).toList();
  }

  List<ChannelModel> getChannelsByCategory(int categoryId) {
    return _allChannels.where((c) => c.categoryId == categoryId).toList();
  }
}
