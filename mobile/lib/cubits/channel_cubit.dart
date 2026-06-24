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
  ChannelLoaded(this.channels, this.categories);
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

  Future<void> loadChannels() async {
    emit(ChannelLoading());
    try {
      final channelRes = await _api.get(ApiEndpoints.channelList);
      final catRes = await _api.get(ApiEndpoints.categoryList);

      if (channelRes['success'] == true && catRes['success'] == true) {
        _allChannels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        _allCategories = (catRes['data'] as List)
            .map((c) => CategoryModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(_allChannels, _allCategories));
      } else {
        emit(ChannelError('Failed to load channels'));
      }
    } catch (e) {
      emit(ChannelError('Unable to load channels. Please check your connection and try again.'));
    }
  }

  Future<void> loadFeaturedChannels() async {
    emit(ChannelLoading());
    try {
      final channelRes = await _api.get('${ApiEndpoints.channelList}?featured=true');
      final catRes = await _api.get(ApiEndpoints.categoryList);

      if (channelRes['success'] == true && catRes['success'] == true) {
        _allChannels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        _allCategories = (catRes['data'] as List)
            .map((c) => CategoryModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(_allChannels, _allCategories));
      } else {
        emit(ChannelError('Failed to load channels'));
      }
    } catch (e) {
      emit(ChannelError('Unable to load channels. Please check your connection and try again.'));
    }
  }

  Future<void> loadPopularChannels() async {
    emit(ChannelLoading());
    try {
      final channelRes = await _api.get('${ApiEndpoints.channelList}?popular=true');
      final catRes = await _api.get(ApiEndpoints.categoryList);

      if (channelRes['success'] == true && catRes['success'] == true) {
        _allChannels = (channelRes['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        _allCategories = (catRes['data'] as List)
            .map((c) => CategoryModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(_allChannels, _allCategories));
      } else {
        emit(ChannelError('Failed to load channels'));
      }
    } catch (e) {
      emit(ChannelError('Unable to load channels. Please check your connection and try again.'));
    }
  }

  Future<void> searchChannels(String query) async {
    if (query.isEmpty) {
      emit(ChannelLoaded(_allChannels, _allCategories));
      return;
    }
    try {
      final response = await _api.get('${ApiEndpoints.channelSearch}?q=$query');
      if (response['success'] == true) {
        final results = (response['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(results, _allCategories));
      }
    } catch (e) {
      emit(ChannelError('Search failed. Please try again.'));
    }
  }

  List<ChannelModel> get allChannels => _allChannels;

  List<ChannelModel> getFeaturedChannels() {
    return _allChannels.where((c) => c.isFeatured).toList();
  }

  List<ChannelModel> getChannelsByCategory(int categoryId) {
    return _allChannels.where((c) => c.categoryId == categoryId).toList();
  }
}
