import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../cubits/home_cubit.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/license_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/channel_logo.dart';
import 'channel_list_screen.dart';
import 'search_screen.dart';
import 'favorites_screen.dart';
import 'profile_screen.dart';
import 'player_screen.dart';

// ─── Shell ────────────────────────────────────────────────────────────────────

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
      body: IndexedStack(index: _selectedIndex, children: _pages),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(AppColors.background),
        border: Border(top: BorderSide(color: Color(0xFF2A2A2A), width: 0.5)),
      ),
      child: NavigationBar(
        backgroundColor: Colors.transparent,
        indicatorColor: const Color(AppColors.primary).withOpacity(0.15),
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
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

  NavigationDestination _navDest(IconData sel, IconData unsel, String label) {
    return NavigationDestination(
      icon: Icon(unsel, color: const Color(AppColors.textSecondary), size: 22),
      selectedIcon: Icon(sel, color: const Color(AppColors.primary), size: 24),
      label: label,
    );
  }

  /// Navigate to the Live TV tab, optionally pre-filtering by category
  void navigateToLiveTV({int? categoryId, String? categoryName, String? language}) {
    setState(() => _selectedIndex = 1);
    if (categoryId != null || language != null) {
      context.read<ChannelCubit>().loadChannels(
        isRefresh: true,
        workingOnly: true,
        categoryId: categoryId ?? 0,
        language: language ?? '',
      );
    }
  }
}

// ─── Home Content ─────────────────────────────────────────────────────────────

class HomeContentScreen extends StatefulWidget {
  const HomeContentScreen({super.key});
  @override
  State<HomeContentScreen> createState() => _HomeContentScreenState();
}

class _HomeContentScreenState extends State<HomeContentScreen> {
  @override
  void initState() {
    super.initState();
    final s = context.read<HomeCubit>().state;
    if (s is! HomeLoaded) {
      context.read<HomeCubit>().loadHome(isRefresh: true);
    }
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    if (h < 21) return 'Good Evening,';
    return 'Good Night,';
  }

  void _seeAll({int? categoryId, String? categoryName, String? language}) {
    // Navigate Live TV tab with filters via parent shell
    final shell = context.findAncestorStateOfType<_HomeScreenState>();
    shell?.navigateToLiveTV(categoryId: categoryId, categoryName: categoryName, language: language);
  }

  void _openPlayer({
    required ChannelModel channel,
    required List<ChannelModel> contextChannels,
    required PlayerSourceType sourceType,
    required ChannelSourceFilters filters,
  }) {
    final index = contextChannels.indexWhere((c) => c.id == channel.id);
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PlayerScreen(
        channel: channel,
        channels: contextChannels,
        initialIndex: index >= 0 ? index : 0,
        sourceType: sourceType,
        sourceFilters: filters,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: BlocBuilder<HomeCubit, HomeState>(
          builder: (context, state) {
            if (state is HomeLoading) return _buildLoadingSkeleton();
            if (state is HomeError) return _buildErrorState(state.message);
            if (state is HomeLoaded) return _buildContent(state);
            return _buildLoadingSkeleton();
          },
        ),
      ),
    );
  }

  Widget _buildContent(HomeLoaded state) {
    return RefreshIndicator(
      color: const Color(AppColors.primary),
      backgroundColor: const Color(AppColors.surface),
      onRefresh: () => context.read<HomeCubit>().loadHome(isRefresh: true),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _buildHeader()),
          SliverToBoxAdapter(child: _buildSearchBar()),
          if (state.error != null)
            SliverToBoxAdapter(child: _buildErrorBanner(state.error!)),
          // 1. Continue Watching
          if (state.continueWatching.isNotEmpty) ...[
            SliverToBoxAdapter(child: _sectionTitle('Continue Watching', onSeeAll: () => _seeAll())),
            SliverToBoxAdapter(child: _buildFeaturedRow(state.continueWatching, PlayerSourceType.homeFeatured, const ChannelSourceFilters())),
          ],
          // 2. Premium Channels
          if (state.premiumChannels.isNotEmpty) ...[
            SliverToBoxAdapter(child: _sectionTitle('Premium Channels',
                icon: Icons.workspace_premium_rounded,
                iconColor: const Color(0xFFFFB300),
                onSeeAll: () => _seeAll())),
            SliverToBoxAdapter(child: _buildFeaturedRow(state.premiumChannels, PlayerSourceType.homeFeatured, const ChannelSourceFilters(premium: true))),
          ],
          // 3. Popular Channels
          if (state.popularChannels.isNotEmpty) ...[
            SliverToBoxAdapter(child: _sectionTitle('Popular Channels',
                icon: Icons.local_fire_department_rounded,
                iconColor: const Color(0xFFFF5722),
                onSeeAll: () => _seeAll())),
            SliverToBoxAdapter(child: _buildGridRow(state.popularChannels.take(12).toList(), PlayerSourceType.homePopular, const ChannelSourceFilters(sort: 'popular'))),
          ],
          // 4. Featured Live
          if (state.featuredChannels.isNotEmpty) ...[
            SliverToBoxAdapter(child: _sectionTitle('Featured Live',
                icon: Icons.live_tv_rounded,
                iconColor: const Color(AppColors.primary),
                onSeeAll: () => _seeAll())),
            SliverToBoxAdapter(child: _buildFeaturedRow(state.featuredChannels, PlayerSourceType.homeFeatured, const ChannelSourceFilters())),
          ],
          // 5. Category Sections
          for (final section in state.categories) ...[
            SliverToBoxAdapter(child: _sectionTitle(section.name,
                onSeeAll: () => _seeAll(categoryId: section.id, categoryName: section.name))),
            SliverToBoxAdapter(child: _buildGridRow(section.channels, PlayerSourceType.category, ChannelSourceFilters(categoryId: section.id, categoryName: section.name))),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }

  // ─── Header ──────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return BlocBuilder<LicenseCubit, LicenseState>(builder: (context, ls) {
      final isPremium = ls is LicenseActive;
      return Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_greeting,
                  style: const TextStyle(
                      color: Color(AppColors.textSecondary), fontSize: 13, fontWeight: FontWeight.w400)),
              const SizedBox(height: 2),
              const Text('Welcome Back',
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
            ]),
            _PremiumBadge(isPremium: isPremium),
          ],
        ),
      );
    });
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(AppColors.surface),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF2E2E2E), width: 1),
          ),
          child: Row(children: [
            const Icon(Icons.search_rounded, color: Color(AppColors.textMuted), size: 20),
            const SizedBox(width: 12),
            Text('Search channels, news, sports…',
                style: const TextStyle(color: Color(AppColors.textMuted), fontSize: 14)),
          ]),
        ),
      ),
    );
  }

  // ─── Section Title ────────────────────────────────────────────────────────

  Widget _sectionTitle(String title, {VoidCallback? onSeeAll, IconData? icon, Color? iconColor}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(children: [
            if (icon != null) ...[
              Icon(icon, color: iconColor ?? const Color(AppColors.primary), size: 18),
              const SizedBox(width: 6),
            ],
            Text(title,
                style: const TextStyle(
                    color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
          ]),
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              style: TextButton.styleFrom(
                  foregroundColor: const Color(AppColors.primary),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Text('See All', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                SizedBox(width: 2),
                Icon(Icons.chevron_right_rounded, size: 16),
              ]),
            ),
        ],
      ),
    );
  }

  // ─── Featured Horizontal Scroll Row ──────────────────────────────────────

  Widget _buildFeaturedRow(List<ChannelModel> channels, PlayerSourceType sourceType, ChannelSourceFilters filters) {
    return SizedBox(
      height: 190,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: channels.length,
        itemBuilder: (context, index) {
          return _FeaturedCard(
            channel: channels[index],
            onTap: () => _openPlayer(
              channel: channels[index],
              contextChannels: channels,
              sourceType: sourceType,
              filters: filters,
            ),
          );
        },
      ),
    );
  }

  // ─── Grid (2-column compact) Row ──────────────────────────────────────────

  Widget _buildGridRow(List<ChannelModel> channels, PlayerSourceType sourceType, ChannelSourceFilters filters) {
    // Horizontal scrolling row of compact channel cards
    return SizedBox(
      height: 160,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: channels.length,
        itemBuilder: (context, index) {
          return _CompactCard(
            channel: channels[index],
            onTap: () => _openPlayer(
              channel: channels[index],
              contextChannels: channels,
              sourceType: sourceType,
              filters: filters,
            ),
          );
        },
      ),
    );
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  Widget _buildLoadingSkeleton() {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _buildHeader()),
        SliverToBoxAdapter(child: _buildSearchBar()),
        SliverToBoxAdapter(child: _sectionTitle('Premium Channels')),
        SliverToBoxAdapter(child: _shimmerRow(height: 190, itemWidth: 220)),
        SliverToBoxAdapter(child: _sectionTitle('Popular Channels')),
        SliverToBoxAdapter(child: _shimmerRow(height: 160, itemWidth: 110)),
        SliverToBoxAdapter(child: _sectionTitle('Hindi News')),
        SliverToBoxAdapter(child: _shimmerRow(height: 160, itemWidth: 110)),
      ],
    );
  }

  Widget _shimmerRow({required double height, required double itemWidth}) {
    return SizedBox(
      height: height,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: 6,
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(AppColors.shimmerBase),
          highlightColor: const Color(AppColors.shimmerHighlight),
          child: Container(
            width: itemWidth,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: const Color(AppColors.surface),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ),
    );
  }

  // ─── Error states ─────────────────────────────────────────────────────────

  Widget _buildErrorBanner(String message) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF2C1010),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(AppColors.primary).withOpacity(0.3)),
      ),
      child: Row(children: [
        const Icon(Icons.wifi_off_rounded, size: 16, color: Colors.white38),
        const SizedBox(width: 8),
        Expanded(child: Text('Could not refresh. Showing saved data.',
            style: const TextStyle(color: Colors.white54, fontSize: 12))),
      ]),
    );
  }

  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.wifi_off_rounded, size: 64, color: Colors.white24),
          const SizedBox(height: 20),
          const Text('Could not load channels', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(color: Colors.white38, fontSize: 13), textAlign: TextAlign.center),
          const SizedBox(height: 28),
          ElevatedButton.icon(
            onPressed: () => context.read<HomeCubit>().loadHome(isRefresh: true),
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Retry'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(AppColors.primary),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Premium Badge ────────────────────────────────────────────────────────────

class _PremiumBadge extends StatelessWidget {
  final bool isPremium;
  const _PremiumBadge({required this.isPremium});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        gradient: isPremium
            ? const LinearGradient(
                colors: [Color(0xFFE50914), Color(0xFFFF4444)],
                begin: Alignment.topLeft, end: Alignment.bottomRight)
            : null,
        color: isPremium ? null : const Color(AppColors.surface),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
            color: isPremium ? Colors.transparent : const Color(0xFF3A3A3A), width: 1),
        boxShadow: isPremium
            ? [BoxShadow(color: const Color(0xFFE50914).withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4))]
            : null,
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 7, height: 7,
          decoration: BoxDecoration(
            color: isPremium ? Colors.white : Colors.grey,
            shape: BoxShape.circle,
            boxShadow: isPremium ? [const BoxShadow(color: Colors.white54, blurRadius: 4)] : null,
          ),
        ),
        const SizedBox(width: 6),
        Text(isPremium ? 'Premium' : 'Free',
            style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: isPremium ? Colors.white : const Color(AppColors.textSecondary),
                letterSpacing: 0.3)),
      ]),
    );
  }
}

// ─── Live Badge ───────────────────────────────────────────────────────────────

class LiveBadge extends StatelessWidget {
  final bool small;
  const LiveBadge({super.key, this.small = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 5 : 7, vertical: small ? 2 : 3),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [Color(0xFFFF1744), Color(0xFFE50914)],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(4),
        boxShadow: [BoxShadow(color: const Color(0xFFE50914).withOpacity(0.5), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: small ? 4 : 5, height: small ? 4 : 5,
          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
        ),
        SizedBox(width: small ? 3 : 4),
        Text('LIVE',
            style: TextStyle(fontSize: small ? 7 : 9, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.8)),
      ]),
    );
  }
}

// ─── Featured Card (wider horizontal card) ────────────────────────────────────

class _FeaturedCard extends StatelessWidget {
  final ChannelModel channel;
  final VoidCallback onTap;
  const _FeaturedCard({required this.channel, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(right: 14),
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 6))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(fit: StackFit.expand, children: [
            // Blurred background
            if (channel.logoUrl != null)
              Positioned.fill(
                child: Opacity(
                  opacity: 0.12,
                  child: ChannelLogo(
                    logoUrl: channel.logoUrl, localLogoUrl: channel.localLogoUrl,
                    channelName: channel.name, size: 220, borderRadius: 0, fit: BoxFit.cover),
                ),
              ),
            // Gradient overlay
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter, end: Alignment.bottomCenter,
                    stops: const [0.0, 0.4, 1.0],
                    colors: [Colors.black.withOpacity(0.1), Colors.black.withOpacity(0.15), Colors.black.withOpacity(0.85)],
                  ),
                ),
              ),
            ),
            // Center logo
            Positioned(top: 24, left: 0, right: 0,
              child: Center(
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 16, spreadRadius: 2)],
                  ),
                  child: ChannelLogo(
                    logoUrl: channel.logoUrl, localLogoUrl: channel.localLogoUrl,
                    channelName: channel.name, size: 72, borderRadius: 12, fit: BoxFit.contain),
                ),
              ),
            ),
            // Badges top-left
            Positioned(top: 8, left: 8,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const LiveBadge(small: true),
                if (channel.isPremium) ...[
                  const SizedBox(width: 4),
                  _PremiumTagBadge(),
                ],
              ]),
            ),
            // Quality top-right
            Positioned(top: 8, right: 8, child: _QualityBadge(channel.qualityLabel)),
            // Bottom info
            Positioned(left: 12, right: 12, bottom: 10,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(channel.name,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white,
                        letterSpacing: -0.2, shadows: [Shadow(blurRadius: 8, color: Colors.black87)]),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                if (channel.categoryName != null)
                  Text(channel.categoryName!,
                      style: const TextStyle(fontSize: 10, color: Colors.white60), maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

// ─── Compact Card (smaller horizontal card in grid rows) ─────────────────────

class _CompactCard extends StatelessWidget {
  final ChannelModel channel;
  final VoidCallback onTap;
  const _CompactCard({required this.channel, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 110,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF2A2A2A), width: 0.5),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 3))],
        ),
        child: Stack(children: [
          // LIVE badge top-right
          Positioned(top: 6, right: 6, child: const LiveBadge(small: true)),
          // Premium badge top-left
          if (channel.isPremium) Positioned(top: 6, left: 6, child: _PremiumTagBadge()),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 16, 8, 8),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF333333), width: 1.5),
                ),
                child: ChannelLogo(
                  logoUrl: channel.logoUrl, localLogoUrl: channel.localLogoUrl,
                  channelName: channel.name, size: 50, borderRadius: 7, fit: BoxFit.contain),
              ),
              const SizedBox(height: 6),
              Text(channel.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Colors.white, letterSpacing: -0.1),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              if (channel.categoryName != null) ...[
                const SizedBox(height: 2),
                Text(channel.categoryName!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 9, color: Color(AppColors.textSecondary)),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

class _PremiumTagBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFFFB300),
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Text('PRO',
          style: TextStyle(fontSize: 7, fontWeight: FontWeight.w800, color: Colors.black, letterSpacing: 0.5)),
    );
  }
}

class _QualityBadge extends StatelessWidget {
  final String label;
  const _QualityBadge(this.label);

  @override
  Widget build(BuildContext context) {
    if (label == 'SD' || label.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: label == '4K' ? const Color(0xFF6200EA) : const Color(0xFF1565C0),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.3)),
    );
  }
}
