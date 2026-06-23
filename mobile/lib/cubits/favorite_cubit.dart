import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/api_service.dart';
import '../models/channel_model.dart';

abstract class FavoriteState {}

class FavoriteInitial extends FavoriteState {}
class FavoriteLoading extends FavoriteState {}
class FavoriteLoaded extends FavoriteState {
  final List<ChannelModel> favorites;
  FavoriteLoaded(this.favorites);
}
class FavoriteError extends FavoriteState {
  final String message;
  FavoriteError(this.message);
}

class FavoriteCubit extends Cubit<FavoriteState> {
  FavoriteCubit() : super(FavoriteInitial());

  final ApiService _api = ApiService();

  Future<void> loadFavorites() async {
    emit(FavoriteLoading());
    try {
      final response = await _api.get('/api/user/favorites');
      if (response['success'] == true) {
        final favs = (response['data'] as List)
            .map((c) => ChannelModel.fromJson(c))
            .toList();
        emit(FavoriteLoaded(favs));
      } else {
        emit(FavoriteLoaded([]));
      }
    } catch (e) {
      emit(FavoriteError(e.toString()));
    }
  }

  Future<void> toggleFavorite(int channelId, {bool isFavorite = false}) async {
    try {
      if (isFavorite) {
        await _api.delete('/api/user/favorites/$channelId');
      } else {
        await _api.post('/api/user/favorites/$channelId', {});
      }
      await loadFavorites();
    } catch (e) {
      emit(FavoriteError(e.toString()));
    }
  }
}
