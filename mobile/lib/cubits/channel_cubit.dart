import 'package:flutter_bloc/flutter_bloc.dart';
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

  ChannelLoaded(this.channels, this.categories, {this.hasMore = false, this.isLoadingMore = false});
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

  Future<void> loadChannels({bool isRefresh = false, String? query, bool? workingOnly}) async {
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

    if (query != null) _currentQuery = query;
    if (workingOnly != null) _workingOnly = workingOnly;

    try {
      final params = <String, dynamic>{
        'page': _currentPage,
        'limit': 50,
      };

      if (_currentQuery.isNotEmpty) params['search'] = _currentQuery;
      if (_workingOnly) params['workingOnly'] = 'true';
      else params['showOffline'] = 'true';

      final channelRes = await _api.get(ApiEndpoints.channelList, queryParameters: params);

      if (_allCategories.isEmpty) {
        final catRes = await _api.get(ApiEndpoints.categoryList);
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
        
        _allChannels.addAll(newChannels);
        
        final pagination = channelRes['pagination'];
        if (pagination != null) {
          _hasMore = pagination['hasMore'] ?? false;
        } else {
          _hasMore = false;
        }

        _currentPage++;
        emit(ChannelLoaded(List.from(_allChannels), _allCategories, hasMore: _hasMore, isLoadingMore: false));
      } else {
        if (_currentPage == 1) emit(ChannelError('Failed to load channels'));
        else emit(ChannelLoaded(List.from(_allChannels), _allCategories, hasMore: _hasMore, isLoadingMore: false));
      }
    } catch (e) {
      if (_currentPage == 1) {
        emit(ChannelError('Unable to load channels. Please check your connection and try again.'));
      } else {
        emit(ChannelLoaded(List.from(_allChannels), _allCategories, hasMore: _hasMore, isLoadingMore: false));
      }
    }
  }

  Future<void> loadFeaturedChannels() async {
    // Basic implementation for compatibility
    emit(ChannelLoading());
    try {
      final channelRes = await _api.get('${ApiEndpoints.channelList}?featured=true');
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

  List<ChannelModel> getFeaturedChannels() {
    return _allChannels.where((c) => c.isFeatured).toList();
  }

  List<ChannelModel> getChannelsByCategory(int categoryId) {
    return _allChannels.where((c) => c.categoryId == categoryId).toList();
  }
}
