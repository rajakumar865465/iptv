import 'package:flutter/material.dart';
import '../../constants.dart';
import '../premium_widgets.dart';

/// Shimmer placeholder for the Favorites screen.
class FavoritesSkeleton extends StatelessWidget {
  const FavoritesSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const NeverScrollableScrollPhysics(),
      slivers: [
        // Header shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
            child: Row(
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LoadingSkeleton(width: 110, height: 22, borderRadius: 6),
                    SizedBox(height: 6),
                    LoadingSkeleton(width: 140, height: 13, borderRadius: 6),
                  ],
                ),
                const Spacer(),
                const LoadingSkeleton(width: 60, height: 34, borderRadius: 20),
              ],
            ),
          ),
        ),
        // Grid shimmer
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
              (_, __) => const SkeletonChannelCard(),
              childCount: 6,
            ),
          ),
        ),
      ],
    );
  }
}
