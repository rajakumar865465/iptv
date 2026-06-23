import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/api_service.dart';
import '../models/channel_model.dart';

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
      final channelRes = await _api.get('/api/channels');
      final catRes = await _api.get('/api/categories');

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
      emit(ChannelError(e.toString()));
    }
  }

  Future<void> searchChannels(String query) async {
    if (query.isEmpty) {
      emit(ChannelLoaded(_allChannels, _allCategories));
      return;
    }
    try {
      final response = await _api.get('/api/channels/search?q=$query');
      if (response['success'] == true) {
        final results = (response['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        emit(ChannelLoaded(results, _allCategories));
      }
    } catch (e) {
      emit(ChannelError(e.toString()));
    }
  }

  List<ChannelModel> getFeaturedChannels() {
    return _allChannels.where((c) => c.isFeatured).toList();
  }

  List<ChannelModel> getChannelsByCategory(int categoryId) {
    return _allChannels.where((c) => c.categoryId == categoryId).toList();
  }
}
