import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
import '../cubits/mini_player_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/favorites/favorites_empty_state.dart';
import '../widgets/premium_channel_card.dart';
import '../widgets/favorites/favorites_header.dart';
import '../widgets/favorites/favorites_skeleton.dart';
import 'channel_list_screen.dart';
import 'player_screen.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  @override
  void initState() {
    super.initState();
    context.read<FavoriteCubit>().loadFavorites();
  }

  void _exploreChannels() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const ChannelListScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: BlocBuilder<FavoriteCubit, FavoriteState>(
          builder: (context, state) {
            if (state is FavoriteLoading) return const FavoritesSkeleton();
            if (state is FavoriteError) return _buildError(state.message);
            if (state is FavoriteLoaded) return _buildContent(state.favorites);
            return const FavoritesSkeleton();
          },
        ),
      ),
    );
  }

  Widget _buildContent(List<ChannelModel> favorites) {
    if (favorites.isEmpty) {
      return Column(
        children: [
          const FavoritesHeader(count: 0),
          Expanded(
            child: FavoritesEmptyState(onExploreChannels: _exploreChannels),
          ),
        ],
      );
    }

    return RefreshIndicator(
      color: const Color(AppColors.primary),
      backgroundColor: const Color(AppColors.surface),
      onRefresh: () => context.read<FavoriteCubit>().loadFavorites(),
      displacement: 16,
      strokeWidth: 2.5,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverToBoxAdapter(
            child: FavoritesHeader(count: favorites.length),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 24),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.78,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final channel = favorites[index];
                  return PremiumChannelCard(
                    channel: channel,
                    variant: PremiumChannelCardVariant.grid,
                    showFavorite: true,
                    onTap: () => _openPlayer(channel, favorites, index),
                  );
                },
                childCount: favorites.length,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(AppColors.error).withOpacity(0.08),
                border: Border.all(
                  color: const Color(AppColors.error).withOpacity(0.15),
                  width: 1,
                ),
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                size: 36,
                color: Color(AppColors.error),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Couldn’t load favorites',
              style: TextStyle(
                color: Color(AppColors.textPrimary),
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message.isNotEmpty ? message : 'Please try again.',
              style: const TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 13,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: 160,
              child: ElevatedButton.icon(
                onPressed: () => context.read<FavoriteCubit>().loadFavorites(),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppColors.primary),
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openPlayer(ChannelModel channel, List<ChannelModel> list, int index) {
    context.read<MiniPlayerCubit>().play(
      channel,
      contextChannels: list,
      initialIndex: index,
      sourceType: PlayerSourceType.favorites,
      sourceFilters: const ChannelSourceFilters(),
    );
  }
}
