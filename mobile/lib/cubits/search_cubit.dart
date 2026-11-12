import 'dart:developer' as developer;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/api_service.dart';
import '../models/channel_model.dart';
import '../constants.dart';
import '../utils/force_update_helper.dart';

abstract class SearchState {}

class SearchInitial extends SearchState {}

class SearchLoading extends SearchState {}

class SearchLoaded extends SearchState {
  final List<ChannelModel> channels;
  final String query;

  SearchLoaded(this.channels, this.query);
}

class SearchForceUpdateRequired extends SearchState {
  final ForceUpdateInfo? info;
  SearchForceUpdateRequired([this.info]);
}

class SearchError extends SearchState {
  final String message;

  SearchError(this.message);
}

class SearchCubit extends Cubit<SearchState> {
  SearchCubit() : super(SearchInitial());

  final ApiService _api = ApiService();
  String _lastQuery = '';

  String get lastQuery => _lastQuery;

  Future<void> search(String query) async {
    final q = query.trim();
    _lastQuery = q;

    if (q.isEmpty) {
      emit(SearchInitial());
      return;
    }

    emit(SearchLoading());

    try {
      final res = await _api.get(
        ApiEndpoints.channelList,
        queryParameters: {
          'search': q,
          'workingOnly': 'true',
          'limit': 50,
        },
      );

      if (isClosed) return;

      if (res['success'] == true) {
        final list = (res['data'] as List? ?? [])
            .map((c) => ChannelModel.fromJson(c as Map<String, dynamic>))
            .where((c) => c.isPlayable)
            .toList();

        final deduped = _deduplicateChannels(list);

        developer.log(
          '[SearchCubit] Found ${deduped.length} channels for "$q"',
          name: 'SearchCubit',
        );

        if (isClosed) return;
        emit(SearchLoaded(deduped, q));
      } else {
        if (isClosed) return;
        emit(SearchError('No channels found for "$q"'));
      }
    } catch (e) {
      developer.log('[SearchCubit] Error searching: $e', name: 'SearchCubit');
      if (isClosed) return;
      if (ForceUpdateHelper.isForceUpdateException(e)) {
        emit(SearchForceUpdateRequired(ForceUpdateHelper.extractInfo(e)));
        return;
      }
      emit(SearchError('Unable to search. Please check your connection.'));
    }
  }

  void clear() {
    _lastQuery = '';
    emit(SearchInitial());
  }

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
}
