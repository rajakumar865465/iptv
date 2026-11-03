import 'package:flutter/material.dart';
import '../../constants.dart';
import '../premium_widgets.dart';
import 'favorites_header.dart';

/// Shimmer placeholder for the My List / Favorites screen.
/// Keeps the persistent "My List" header visible while cards load.
class FavoritesSkeleton extends StatelessWidget {
  const FavoritesSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const NeverScrollableScrollPhysics(),
      slivers: [
        // Persistent screen header
        const SliverToBoxAdapter(
          child: FavoritesHeader(count: 0),
        ),
        // 3-column grid shimmer with layered inner placeholders
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            14,
            8,
            14,
            AppConstants.bottomNavClearance,
          ),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 0.72,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, __) => const SkeletonChannelCard(),
              childCount: 9,
            ),
          ),
        ),
      ],
    );
  }
}
