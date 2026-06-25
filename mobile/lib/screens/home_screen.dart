import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/license_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/channel_logo.dart';
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

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pages = [
      const HomeContentScreen(),
      const ChannelListScreen(),
      const SearchScreen(),
      const FavoritesScreen(),
      const ProfileScreen(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: IndexedStack(
        index: _selectedIndex,
        children: _pages,
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(AppColors.background),
        border: const Border(
          top: BorderSide(color: Color(0xFF2A2A2A), width: 0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: NavigationBar(
        backgroundColor: Colors.transparent,
        indicatorColor: const Color(AppColors.primary).withOpacity(0.15),
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) => setState(() => _selectedIndex = index),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        height: 64,
        destinations: [
          _navDest(Icons.home_rounded, Icons.home_outlined, 'Home'),
          _navDest(Icons.live_tv_rounded, Icons.live_tv_outlined, 'Live TV'),
          _navDest(Icons.search_rounded, Icons.search_outlined, 'Search'),
          _navDest(Icons.favorite_rounded, Icons.favorite_border_rounded, 'Favorites'),
          _navDest(Icons.person_rounded, Icons.person_outline_rounded, 'Profile'),
        ],
      ),
    );
  }

  NavigationDestination _navDest(IconData selected, IconData unselected, String label) {
    return NavigationDestination(
      icon: Icon(unselected, color: const Color(AppColors.textSecondary), size: 22),
      selectedIcon: Icon(selected, color: const Color(AppColors.primary), size: 24),
      label: label,
    );
  }
}

// ─── Home Content ────────────────────────────────────────────────────────────

class HomeContentScreen extends StatefulWidget {
  const HomeContentScreen({super.key});

  @override
  State<HomeContentScreen> createState() => _HomeContentScreenState();
}

class _HomeContentScreenState extends State<HomeContentScreen> {
  @override
  void initState() {
    super.initState();
    // Fix #13: Use isRefresh: true to avoid duplicating channels if already loaded
    // from SplashScreen. Without this, channels are appended instead of replaced.
    final currentState = context.read<ChannelCubit>().state;
    if (currentState is! ChannelLoaded) {
      context.read<ChannelCubit>().loadChannels(isRefresh: true);
    }
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    if (h < 21) return 'Good Evening,';
    return 'Good Night,';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHeader()),
            SliverToBoxAdapter(child: _buildSearchBar(context)),
            SliverToBoxAdapter(child: _buildSectionTitle('Featured Channels', onSeeAll: () {
              // Navigate to the Live TV tab (index 1) via the parent HomeScreen
              // The IndexedStack in HomeScreen handles tab switching
            })),
            SliverToBoxAdapter(child: _buildFeaturedSection()),
            SliverToBoxAdapter(child: _buildSectionTitle('Popular Channels', onSeeAll: () {
              // Navigate to Live TV tab — parent HomeScreen handles tab switching via IndexedStack
            })),
            // Fix #27: Use SliverGrid instead of GridView(shrinkWrap:true) for
            // efficient lazy rendering — shrinkWrap forces full upfront measurement
            _buildPopularSliver(),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return BlocBuilder<LicenseCubit, LicenseState>(
      builder: (context, licenseState) {
        final bool isPremium = licenseState is LicenseActive;
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  _greeting,
                  style: TextStyle(
                    color: const Color(AppColors.textSecondary),
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Welcome Back',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                  ),
                ),
              ]),
              _buildPremiumBadge(isPremium),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPremiumBadge(bool isPremium) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        gradient: isPremium
            ? const LinearGradient(
                colors: [Color(0xFFE50914), Color(0xFFFF4444)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: isPremium ? null : const Color(AppColors.surface),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isPremium ? Colors.transparent : const Color(0xFF3A3A3A),
          width: 1,
        ),
        boxShadow: isPremium
            ? [BoxShadow(color: const Color(0xFFE50914).withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4))]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: isPremium ? Colors.white : Colors.grey,
              shape: BoxShape.circle,
              boxShadow: isPremium ? [const BoxShadow(color: Colors.white54, blurRadius: 4)] : null,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isPremium ? 'Premium' : 'Free',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isPremium ? Colors.white : const Color(AppColors.textSecondary),
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const SearchScreen()),
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(AppColors.surface),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF2E2E2E), width: 1),
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, color: Color(AppColors.textMuted), size: 20),
              const SizedBox(width: 12),
              Text(
                'Search channels...',
                style: TextStyle(
                  color: const Color(AppColors.textMuted),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, {VoidCallback? onSeeAll}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
            ),
          ),
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              style: TextButton.styleFrom(
                foregroundColor: const Color(AppColors.primary),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              ),
              child: const Text('See All', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }

  // ─── Featured Section ─────────────────────────────────────────────────────

  Widget _buildFeaturedSection() {
    return BlocBuilder<ChannelCubit, ChannelState>(
      builder: (context, state) {
        if (state is ChannelLoading) return _buildFeaturedShimmer();
        if (state is ChannelError) return _buildErrorWidget(state.message, () => context.read<ChannelCubit>().loadChannels());
        if (state is ChannelLoaded) {
          final featured = state.channels.where((c) => c.isFeatured).toList();
          if (featured.isEmpty) {
            return _buildEmptyWidget('No featured channels yet.');
          }
          return _buildFeaturedList(featured);
        }
        return const SizedBox();
      },
    );
  }

  Widget _buildFeaturedList(List<ChannelModel> channels) {
    return SizedBox(
      height: 200,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: channels.length,
        itemBuilder: (context, index) {
          final channel = channels[index];
          return GestureDetector(
            onTap: () => _openPlayer(context, channel.id),
            child: Container(
              width: 230,
              margin: const EdgeInsets.only(right: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: const Color(AppColors.surface),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Blurred background logo
                    if (channel.logoUrl != null)
                      Positioned.fill(
                        child: Opacity(
                          opacity: 0.15,
                          child: ChannelLogo(
                            logoUrl: channel.logoUrl,
                            localLogoUrl: channel.localLogoUrl,
                            channelName: channel.name,
                            size: 230,
                            borderRadius: 0,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    // Gradient overlay
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            stops: const [0.0, 0.45, 1.0],
                            colors: [
                              Colors.black.withOpacity(0.1),
                              Colors.black.withOpacity(0.2),
                              Colors.black.withOpacity(0.9),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Center logo
                    Positioned(
                      top: 28,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.5),
                                blurRadius: 16,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: ChannelLogo(
                            logoUrl: channel.logoUrl,
                            localLogoUrl: channel.localLogoUrl,
                            channelName: channel.name,
                            size: 78,
                            borderRadius: 14,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                    // Bottom info
                    Positioned(
                      left: 12,
                      right: 12,
                      bottom: 12,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _LiveBadge(),
                          const SizedBox(height: 5),
                          Text(
                            channel.name,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: -0.2,
                              shadows: [Shadow(blurRadius: 8, color: Colors.black87)],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (channel.categoryName != null)
                            Text(
                              channel.categoryName!,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.white60,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
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

  // ─── Popular Section ──────────────────────────────────────────────────────

  // Fix #27: Return a Sliver instead of a shrinkWrap GridView to avoid expensive
  // full-height measurement that freezes the UI with 30 items.
  Widget _buildPopularSliver() {
    return BlocBuilder<ChannelCubit, ChannelState>(
      builder: (context, state) {
        if (state is ChannelLoading) return _buildPopularShimmerSliver();
        if (state is ChannelError) return SliverToBoxAdapter(child: _buildErrorWidget(state.message, () => context.read<ChannelCubit>().loadChannels()));
        if (state is ChannelLoaded) {
          if (state.channels.isEmpty) return SliverToBoxAdapter(child: _buildEmptyWidget('No channels available yet.'));
          final count = state.channels.length > 30 ? 30 : state.channels.length;
          return SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 0.75,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) => _buildPopularCard(state.channels[index]),
                childCount: count,
              ),
            ),
          );
        }
        return const SliverToBoxAdapter(child: SizedBox.shrink());
      },
    );
  }

  // Keep old _buildPopularSection removed — replaced by _buildPopularSliver (Fix #27)

  Widget _buildPopularCard(ChannelModel channel) {
    return GestureDetector(
      onTap: () => _openPlayer(context, channel.id),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF2A2A2A), width: 0.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Stack(
          children: [
            // LIVE badge
            Positioned(
              top: 6,
              right: 6,
              child: _LiveBadge(small: true),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo with subtle ring
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(11),
                      border: Border.all(color: const Color(0xFF333333), width: 1.5),
                    ),
                    child: ChannelLogo(
                      logoUrl: channel.logoUrl,
                      localLogoUrl: channel.localLogoUrl,
                      channelName: channel.name,
                      size: 54,
                      borderRadius: 8,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    channel.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      letterSpacing: -0.1,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (channel.categoryName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      channel.categoryName!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 9,
                        color: Color(AppColors.textSecondary),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPopularShimmerSliver() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 0.75,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        delegate: SliverChildBuilderDelegate(
          (_, __) => Shimmer.fromColors(
            baseColor: const Color(AppColors.shimmerBase),
            highlightColor: const Color(AppColors.shimmerHighlight),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(AppColors.surface),
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          childCount: 9,
        ),
      ),
    );
  }

  Widget _buildFeaturedShimmer() {
    return SizedBox(
      height: 200,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: 4,
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(AppColors.shimmerBase),
          highlightColor: const Color(AppColors.shimmerHighlight),
          child: Container(
            width: 230,
            margin: const EdgeInsets.only(right: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: const Color(AppColors.surface),
            ),
          ),
        ),
      ),
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  Widget _buildErrorWidget(String message, VoidCallback onRetry) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.wifi_off_rounded, color: Colors.white38, size: 48),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54, fontSize: 14)),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Retry'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(AppColors.primary),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyWidget(String message) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(color: Colors.white38, fontSize: 14),
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

// ─── Live Badge ───────────────────────────────────────────────────────────────

class _LiveBadge extends StatelessWidget {
  final bool small;
  const _LiveBadge({this.small = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 5 : 7, vertical: small ? 2 : 3),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFF1744), Color(0xFFE50914)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFE50914).withOpacity(0.5),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: small ? 4 : 5,
            height: small ? 4 : 5,
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
          ),
          SizedBox(width: small ? 3 : 4),
          Text(
            'LIVE',
            style: TextStyle(
              fontSize: small ? 7 : 9,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}
