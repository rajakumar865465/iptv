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
              height: 56,
              borderRadius: 18,
            ),
          ),
        ),
        // Toggle shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 2, 14, 8),
            child: LoadingSkeleton(
              width: double.infinity,
              height: 58,
              borderRadius: 16,
            ),
          ),
        ),
        // Chip row shimmer
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
                child: LoadingSkeleton(width: 80, height: 36, borderRadius: 22),
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 8)),
        // Count bar shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 6),
            child: Row(
              children: [
                const LoadingSkeleton(width: 8, height: 8, borderRadius: 4),
                const SizedBox(width: 6),
                const LoadingSkeleton(width: 120, height: 12, borderRadius: 6),
              ],
            ),
          ),
        ),
        // Grid shimmer
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.78,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, __) => const SkeletonChannelCard(),
              childCount: 10,
            ),
          ),
        ),
      ],
    );
  }
}
