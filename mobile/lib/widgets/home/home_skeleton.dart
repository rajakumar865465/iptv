import 'package:flutter/material.dart';
import '../../constants.dart';
import '../premium_widgets.dart';

/// Full shimmer loading placeholder for the premium home screen.
class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // Header shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
            child: Row(
              children: [
                const LoadingSkeleton(width: 34, height: 34, borderRadius: 10),
                const SizedBox(width: 10),
                const LoadingSkeleton(width: 90, height: 16, borderRadius: 8),
                const Spacer(),
                const LoadingSkeleton(width: 76, height: 30, borderRadius: 20),
                const SizedBox(width: 10),
                const LoadingSkeleton(width: 40, height: 40, borderRadius: 20),
              ],
            ),
          ),
        ),
        // Search shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: LoadingSkeleton(
              width: double.infinity,
              height: 54,
              borderRadius: 18,
            ),
          ),
        ),
        // Hero shimmer
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: LoadingSkeleton(
              width: double.infinity,
              height: 172,
              borderRadius: 24,
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 26)),
        // Featured section shimmer
        SliverToBoxAdapter(child: _sectionTitleShimmer()),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 188,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: 4,
              itemBuilder: (_, __) => const Padding(
                padding: EdgeInsets.only(right: 14),
                child: LoadingSkeleton(width: 232, height: 188, borderRadius: 22),
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 26)),
        // Compact section shimmer x3
        SliverToBoxAdapter(child: _sectionTitleShimmer()),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 168,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: 5,
              itemBuilder: (_, __) => const Padding(
                padding: EdgeInsets.only(right: 12),
                child: LoadingSkeleton(width: 118, height: 168, borderRadius: 20),
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 26)),
        SliverToBoxAdapter(child: _sectionTitleShimmer()),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 168,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: 5,
              itemBuilder: (_, __) => const Padding(
                padding: EdgeInsets.only(right: 12),
                child: LoadingSkeleton(width: 118, height: 168, borderRadius: 20),
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  Widget _sectionTitleShimmer() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 16, 12),
      child: Row(
        children: [
          const LoadingSkeleton(width: 3.5, height: 20, borderRadius: 2),
          const SizedBox(width: 10),
          const LoadingSkeleton(width: 28, height: 28, borderRadius: 8),
          const SizedBox(width: 10),
          const LoadingSkeleton(width: 140, height: 16, borderRadius: 8),
          const Spacer(),
          const LoadingSkeleton(width: 64, height: 26, borderRadius: 20),
        ],
      ),
    );
  }
}
