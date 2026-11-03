import 'package:flutter/material.dart';
import '../../constants.dart';
import '../premium_widgets.dart';

/// Premium skeleton placeholder for the Live TV screen.
class LiveTvSkeleton extends StatelessWidget {
  const LiveTvSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const NeverScrollableScrollPhysics(),
      slivers: [
        // App bar shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 16, 6),
            child: Row(
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LoadingSkeleton(width: 80, height: 22, borderRadius: 6),
                    SizedBox(height: 6),
                    LoadingSkeleton(width: 110, height: 12, borderRadius: 6),
                  ],
                ),
                const Spacer(),
                const LoadingSkeleton(width: 80, height: 36, borderRadius: 12),
                const SizedBox(width: 8),
                const LoadingSkeleton(width: 38, height: 38, borderRadius: 12),
              ],
            ),
          ),
        ),
        // Search shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
            child: LoadingSkeleton(
              width: double.infinity,
              height: 48,
              borderRadius: 14,
            ),
          ),
        ),
        // Genre chip row shimmer
        SliverToBoxAdapter(
          child: SizedBox(
            height: 40,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              itemCount: 6,
              itemBuilder: (_, __) => const Padding(
                padding: EdgeInsets.only(right: 8),
                child: LoadingSkeleton(width: 84, height: 34, borderRadius: 20),
              ),
            ),
          ),
        ),
        // Compact status + Working-only pill bar shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                const LoadingSkeleton(width: 8, height: 8, borderRadius: 4),
                const SizedBox(width: 7),
                const LoadingSkeleton(width: 120, height: 12, borderRadius: 6),
                const Spacer(),
                const LoadingSkeleton(width: 100, height: 28, borderRadius: 16),
              ],
            ),
          ),
        ),
        // Grid shimmer
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            14,
            4,
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
