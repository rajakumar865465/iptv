import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/favorite_cubit.dart';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        elevation: 0,
        title: const Text('Favorites', style: TextStyle(color: Colors.white)),
      ),
      body: BlocBuilder<FavoriteCubit, FavoriteState>(
        builder: (context, state) {
          if (state is FavoriteLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is FavoriteLoaded) {
            if (state.favorites.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.favorite_outline, size: 64, color: Colors.white54),
                    SizedBox(height: 16),
                    Text('No favorites yet', style: TextStyle(color: Colors.white54)),
                    SizedBox(height: 8),
                    Text('Tap the heart icon on any channel to add it here',
                        style: TextStyle(color: Colors.white38, fontSize: 12)),
                  ],
                ),
              );
            }
            return ListView.builder(
              itemCount: state.favorites.length,
              itemBuilder: (context, index) {
                final channel = state.favorites[index];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: const Color(AppColors.surfaceLight),
                    child: Text(channel.name.substring(0, 1), style: const TextStyle(color: Colors.white)),
                  ),
                  title: Text(channel.name, style: const TextStyle(color: Colors.white)),
                  subtitle: Text(channel.categoryName ?? '', style: const TextStyle(color: Colors.white54)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.favorite, color: Color(AppColors.primary)),
                        onPressed: () {
                          context.read<FavoriteCubit>().toggleFavorite(channel.id, isFavorite: true);
                        },
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                        child: const Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
                      ),
                    ],
                  ),
                  onTap: () {
                    // Pass favorites list for prev/next navigation within favorites
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => PlayerScreen(
                        channel: channel,
                        channels: state.favorites,
                        initialIndex: index,
                      )),
                    );
                  },
                );
              },
            );
          }
          return const Center(child: Text('Error loading favorites', style: TextStyle(color: Colors.white54)));
        },
      ),
    );
  }
}
