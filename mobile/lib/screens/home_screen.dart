import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/license_cubit.dart';
import '../models/channel_model.dart';
import 'channel_list_screen.dart';
import 'search_screen.dart';
import 'favorites_screen.dart';
import 'profile_screen.dart';
import 'player_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  final List<Widget> _pages = [
    const HomeContentScreen(),
    const ChannelListScreen(),
    const SearchScreen(),
    const FavoritesScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: _pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(AppColors.background),
        selectedItemColor: const Color(AppColors.primary),
        unselectedItemColor: const Color(AppColors.textSecondary),
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.live_tv), label: 'Live TV'),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search'),
          BottomNavigationBarItem(icon: Icon(Icons.favorite), label: 'Favorites'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class HomeContentScreen extends StatefulWidget {
  const HomeContentScreen({super.key});

  @override
  State<HomeContentScreen> createState() => _HomeContentScreenState();
}

class _HomeContentScreenState extends State<HomeContentScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ChannelCubit>().loadChannels();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _buildHeader(),
              ),
            ),
            SliverToBoxAdapter(child: _buildSearchBar(context)),
            SliverToBoxAdapter(child: _buildSectionTitle('Featured Channels', onSeeAll: () {})),
            SliverToBoxAdapter(child: _buildFeaturedSection()),
            SliverToBoxAdapter(child: _buildSectionTitle('Popular Channels', onSeeAll: () {})),
            SliverToBoxAdapter(child: _buildPopularSection()),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return BlocBuilder<LicenseCubit, LicenseState>(
      builder: (context, licenseState) {
        final bool isPremium = licenseState is LicenseActive;
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Good Evening,', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(AppColors.textSecondary))),
              const SizedBox(height: 4),
              Text('Welcome Back', style: Theme.of(context).textTheme.titleLarge),
            ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isPremium ? const Color(AppColors.primary).withOpacity(0.2) : const Color(AppColors.surface),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isPremium ? const Color(AppColors.primary) : const Color(AppColors.textMuted)),
              ),
              child: Row(
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: isPremium ? Colors.red : Colors.grey, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(isPremium ? 'Premium' : 'Free', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: GestureDetector(
        onTap: () {
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen()));
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(AppColors.surface),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.search, color: Color(AppColors.textSecondary)),
              const SizedBox(width: 12),
              Text('Search channels...', style: TextStyle(color: const Color(AppColors.textMuted))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, {VoidCallback? onSeeAll}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          if (onSeeAll != null)
            TextButton(onPressed: onSeeAll, child: const Text('See All')),
        ],
      ),
    );
  }

  Widget _buildFeaturedSection() {
    return BlocBuilder<ChannelCubit, ChannelState>(
      builder: (context, state) {
        if (state is ChannelLoading) {
          return _buildFeaturedShimmer();
        }
        if (state is ChannelError) {
          return _buildErrorWidget(state.message, () => context.read<ChannelCubit>().loadChannels());
        }
        if (state is ChannelLoaded) {
          final featured = state.channels.where((c) => c.isFeatured).toList();
          if (featured.isEmpty) {
            return _buildEmptyWidget('No featured channels yet');
          }
          return _buildFeaturedChannelList(featured);
        }
        return const SizedBox();
      },
    );
  }

  Widget _buildPopularSection() {
    return BlocBuilder<ChannelCubit, ChannelState>(
      builder: (context, state) {
        if (state is ChannelLoading) {
          return _buildPopularShimmer();
        }
        if (state is ChannelError) {
          return _buildErrorWidget(state.message, () => context.read<ChannelCubit>().loadChannels());
        }
        if (state is ChannelLoaded) {
          if (state.channels.isEmpty) {
            return _buildEmptyWidget('No channels available');
          }
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: state.channels.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 0.8,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemBuilder: (context, index) => _buildChannelCard(state.channels[index]),
            ),
          );
        }
        return const SizedBox();
      },
    );
  }

  Widget _buildFeaturedShimmer() {
    return SizedBox(
      height: 150,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: 5,
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(AppColors.shimmerBase),
          highlightColor: const Color(AppColors.shimmerHighlight),
          child: Container(
            width: 220,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: const Color(AppColors.surface),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPopularShimmer() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 6,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 0.8,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(AppColors.shimmerBase),
          highlightColor: const Color(AppColors.shimmerHighlight),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(AppColors.surface),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorWidget(String message, VoidCallback onRetry) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: Colors.white54, size: 48),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildEmptyWidget(String message) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Center(
        child: Text(message, style: const TextStyle(color: Colors.white54)),
      ),
    );
  }

  Widget _buildFeaturedChannelList(List<ChannelModel> channels) {
    return SizedBox(
      height: 150,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: channels.length,
        itemBuilder: (context, index) {
          final channel = channels[index];
          return GestureDetector(
            onTap: () => _openPlayer(context, channel.id),
            child: Container(
              width: 220,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: const Color(AppColors.surface),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Stack(
                  children: [
                    Container(color: const Color(AppColors.surfaceLight)),
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(colors: [Colors.transparent, Colors.black.withOpacity(0.8)]),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                            child: const Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
                          ),
                          const SizedBox(height: 6),
                          Text(channel.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildChannelCard(ChannelModel channel) {
    return GestureDetector(
      onTap: () => _openPlayer(context, channel.id),
      child: Container(
        decoration: BoxDecoration(color: const Color(AppColors.surface), borderRadius: BorderRadius.circular(12)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(radius: 28, backgroundColor: const Color(AppColors.surfaceLight), child: Text(channel.name.substring(0, 1))),
            const SizedBox(height: 8),
            Text(channel.name, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
            const SizedBox(height: 2),
            Text(channel.categoryName ?? '', textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, color: Color(AppColors.textSecondary))),
          ],
        ),
      ),
    );
  }

  void _openPlayer(BuildContext context, int channelId) {
    final cubit = context.read<ChannelCubit>();
    final allChannels = cubit.allChannels;
    final index = allChannels.indexWhere((c) => c.id == channelId);
    if (index < 0) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PlayerScreen(
        channel: allChannels[index],
        channels: allChannels,
        initialIndex: index,
      ),
    ));
  }
}
