import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/home_cubit.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/favorite_cubit.dart';
import '../cubits/license_cubit.dart';
import '../models/channel_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/premium_widgets.dart';
import '../widgets/home/home_empty_state.dart';
import '../widgets/premium_channel_card.dart';
import '../widgets/home/home_header.dart';
import '../widgets/home/home_hero.dart';
import '../widgets/home/home_search_bar.dart';
import '../widgets/home/home_section_header.dart';
import '../widgets/home/home_skeleton.dart';
import '../widgets/navigation/app_bottom_nav.dart';
import '../widgets/navigation/keep_alive_page.dart';
import '../widgets/home/notifications_sheet.dart';
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
  late final PageController _pageController;
  late final List<Widget> _pages;

  static const _navItems = [
    AppNavItem(icon: Icons.home_rounded, label: 'Home'),
    AppNavItem(icon: Icons.live_tv_rounded, label: 'Live TV'),
    AppNavItem(icon: Icons.search_rounded, label: 'Search'),
    AppNavItem(icon: Icons.favorite_rounded, label: 'My List'),
    AppNavItem(icon: Icons.person_rounded, label: 'Profile'),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _pages = [
      const KeepAlivePage(child: HomeContentScreen()),
      const KeepAlivePage(child: ChannelListScreen()),
      const KeepAlivePage(child: SearchScreen()),
      const KeepAlivePage(child: FavoritesScreen()),
      const KeepAlivePage(child: ProfileScreen()),
    ];
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: _pages,
        onPageChanged: (index) => setState(() => _selectedIndex = index),
      ),
      bottomNavigationBar: AppBottomNav(
        selectedIndex: _selectedIndex,
        onTap: _onTabTapped,
        items: _navItems,
      ),
    );
  }

  void _onTabTapped(int index) {
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOut,
    );
  }

  void navigateToLiveTV({int? categoryId, String? categoryName, String? language}) {
    _onTabTapped(1);
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
  String _userName = '';
  String _greeting = '';
  bool _hasUnreadNotifications = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
    _checkUnreadNotifications();
    final homeState = context.read<HomeCubit>().state;
    if (homeState is! HomeLoaded) {
      context.read<HomeCubit>().loadHome(isRefresh: true);
    }
    final channelState = context.read<ChannelCubit>().state;
    if (channelState is! ChannelLoaded) {
      context.read<ChannelCubit>().loadChannels(
        isRefresh: true,
        workingOnly: true,
        sortBy: 'popular',
      );
    }
  }

  Future<void> _checkUnreadNotifications() async {
    try {
      final storage = StorageService();
      final clearedAt = await storage.getNotificationsClearedAt();
      final api = ApiService();
      final res = await api.get(ApiEndpoints.userNotifications);
      final raw = res['data'] as List;
      final hasUnread = raw.any((e) {
        final created = DateTime.tryParse(e['created_at'] ?? '');
        if (created == null) return false;
        return clearedAt == null || created.isAfter(clearedAt);
      });
      if (mounted) setState(() => _hasUnreadNotifications = hasUnread);
    } catch (_) {}
  }

  Future<void> _loadUserData() async {
    final storage = StorageService();
    final user = await storage.getUser();
    if (mounted) {
      setState(() {
        _userName = user?.fullName ?? '';
        _greeting = _getGreeting();
      });
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  void _seeAll({int? categoryId, String? categoryName, String? language}) {
    final shell = context.findAncestorStateOfType<_HomeScreenState>();
    shell?.navigateToLiveTV(
      categoryId: categoryId,
      categoryName: categoryName,
      language: language,
    );
  }

  void _openSearch() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (_, anim, __) => const SearchScreen(),
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: anim,
          child: child,
        ),
        transitionDuration: const Duration(milliseconds: 220),
      ),
    );
  }

  void _openPlayer({
    required ChannelModel channel,
    required List<ChannelModel> contextChannels,
    required PlayerSourceType sourceType,
    required ChannelSourceFilters filters,
  }) {
    final index = contextChannels.indexWhere((c) => c.id == channel.id);
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (_, anim, __) => PlayerScreen(
          channel: channel,
          channels: contextChannels,
          initialIndex: index >= 0 ? index : 0,
          sourceType: sourceType,
          sourceFilters: filters,
        ),
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: anim,
          child: child,
        ),
        transitionDuration: const Duration(milliseconds: 250),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: BlocBuilder<HomeCubit, HomeState>(
          builder: (context, state) {
            if (state is HomeLoading) return const HomeSkeleton();
            if (state is HomeError) return _buildFullError(state.message);
            if (state is HomeLoaded) return _buildContent(state);
            return const HomeSkeleton();
          },
        ),
      ),
    );
  }

  // ─── Main content ─────────────────────────────────────────────────────────

  bool _hasAnySection(HomeLoaded state) =>
      state.continueWatching.isNotEmpty ||
      state.premiumChannels.isNotEmpty ||
      state.popularChannels.isNotEmpty ||
      state.featuredChannels.isNotEmpty ||
      state.categories.isNotEmpty;

  Widget _buildContent(HomeLoaded state) {
    return RefreshIndicator(
      color: const Color(AppColors.primary),
      backgroundColor: const Color(AppColors.surface),
      onRefresh: () => context.read<HomeCubit>().loadHome(isRefresh: true),
      displacement: 16,
      strokeWidth: 2.5,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverToBoxAdapter(
            child: BlocBuilder<LicenseCubit, LicenseState>(
              builder: (context, ls) => HomeHeader(
                greeting: _greeting,
                userName: _userName,
                isPremium: ls is LicenseActive,
                onNotificationTap: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const NotificationsSheet(),
                  ).then((_) => _checkUnreadNotifications());
                },
                hasUnreadNotifications: _hasUnreadNotifications,
                onPremiumTap: () => _seeAll(),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: HomeSearchBar(
              onTap: _openSearch,
              hint: 'Search channels, movies, news & more...',
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _buildQuickCategoryChips(),
            ),
          ),
          SliverToBoxAdapter(
            child: HomeHero(onStartWatching: () => _seeAll()),
          ),

          if (state.error != null)
            SliverToBoxAdapter(child: ErrorBanner(state.error!)),

          // Fallback: home API returned no sections → render channels from ChannelCubit
          if (!_hasAnySection(state))
            SliverToBoxAdapter(
              child: BlocBuilder<ChannelCubit, ChannelState>(
                builder: (context, cs) => _buildChannelFallback(cs),
              ),
            ),

          // Popular Channels (Trending Now)
          if (state.popularChannels.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: HomeSectionHeader(
                title: '🔥 Trending Now',
                icon: Icons.local_fire_department_rounded,
                accentColor: const Color(0xFFFF5722),
                onSeeAll: () => _seeAll(),
              ),
            ),
            SliverToBoxAdapter(
              child: _buildCompactRow(
                state.popularChannels.take(14).toList(),
                PlayerSourceType.homePopular,
                const ChannelSourceFilters(sort: 'popular'),
              ),
            ),
          ],

          // Continue Watching
          if (state.continueWatching.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: HomeSectionHeader(
                title: 'Continue Watching',
                icon: Icons.history_rounded,
                accentColor: const Color(0xFF0EA5E9),
                onSeeAll: () => _seeAll(),
              ),
            ),
            SliverToBoxAdapter(
              child: _buildFeaturedRow(
                state.continueWatching,
                PlayerSourceType.homeFeatured,
                const ChannelSourceFilters(),
              ),
            ),
          ],


          // Category sections (capped at top 6 curated channels per category)
          for (final section in _orderSections(state.categories)) ...[
            SliverToBoxAdapter(
              child: HomeSectionHeader(
                title: section.name,
                icon: _categoryIcon(section.name),
                accentColor: _categoryColor(section.name),
                onSeeAll: () => _seeAll(
                  categoryId: section.id,
                  categoryName: section.name,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _buildCompactRow(
                section.channels.take(6).toList(),
                PlayerSourceType.category,
                ChannelSourceFilters(
                  categoryId: section.id,
                  categoryName: section.name,
                ),
              ),
            ),
          ],

          const SliverToBoxAdapter(child: SizedBox(height: 36)),
        ],
      ),
    );
  }

  // ─── Featured wide horizontal row ─────────────────────────────────────────

  Widget _buildFeaturedRow(
    List<ChannelModel> channels,
    PlayerSourceType sourceType,
    ChannelSourceFilters filters,
  ) {
    return SizedBox(
      height: 188,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: channels.length,
        itemBuilder: (context, i) => PremiumChannelCard(
          channel: channels[i],
          variant: PremiumChannelCardVariant.featured,
          onTap: () => _openPlayer(
            channel: channels[i],
            contextChannels: channels,
            sourceType: sourceType,
            filters: filters,
          ),
        ),
      ),
    );
  }

  // ─── Compact square channel row ────────────────────────────────────────────

  Widget _buildCompactRow(
    List<ChannelModel> channels,
    PlayerSourceType sourceType,
    ChannelSourceFilters filters,
  ) {
    return SizedBox(
      height: 146,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: channels.length,
        itemBuilder: (context, i) {
          final channel = channels[i];
          return BlocBuilder<FavoriteCubit, FavoriteState>(
            builder: (context, favState) {
              bool isFav = false;
              if (favState is FavoriteLoaded) {
                isFav = favState.favorites.any((f) => f.id == channel.id);
              }
              return PremiumChannelCard(
                channel: channel,
                variant: PremiumChannelCardVariant.compact,
                showFavorite: true,
                isFavorite: isFav,
                onFavoriteToggle: () =>
                    context.read<FavoriteCubit>().toggleFavorite(channel.id, isFavorite: isFav),
                onTap: () => _openPlayer(
                  channel: channel,
                  contextChannels: channels,
                  sourceType: sourceType,
                  filters: filters,
                ),
              );
            },
          );
        },
      ),
    );
  }

  // ─── Channel fallback (when /api/home returns no sections) ───────────────

  Widget _buildChannelFallback(ChannelState channelState) {
    if (channelState is ChannelLoading) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 26),
          _fallbackSectionShimmer(),
          const SizedBox(height: 26),
          _fallbackSectionShimmer(),
          const SizedBox(height: 26),
          _fallbackSectionShimmer(),
        ],
      );
    }

    if (channelState is ChannelLoaded && channelState.channels.isNotEmpty) {
      final channels = channelState.channels;

      // Group channels by category
      final Map<String, List<ChannelModel>> byCategory = {};
      for (final ch in channels) {
        final cat = (ch.categoryName != null && ch.categoryName!.isNotEmpty)
            ? ch.categoryName!
            : 'General';
        byCategory.putIfAbsent(cat, () => []).add(ch);
      }

      final sortedEntries = _orderCategoryEntries(byCategory);

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 18),
          HomeSectionHeader(
            title: 'Popular Channels',
            icon: Icons.local_fire_department_rounded,
            accentColor: const Color(0xFFFF5722),
            onSeeAll: () => _seeAll(),
          ),
          _buildCompactRow(
            channels.take(14).toList(),
            PlayerSourceType.homePopular,
            const ChannelSourceFilters(sort: 'popular'),
          ),
          for (final entry in sortedEntries.take(6)) ...[
            const SizedBox(height: 12),
            HomeSectionHeader(
              title: entry.key,
              icon: _categoryIcon(entry.key),
              accentColor: _categoryColor(entry.key),
              onSeeAll: () => _seeAll(categoryName: entry.key),
            ),
            _buildCompactRow(
              entry.value.take(12).toList(),
              PlayerSourceType.category,
              ChannelSourceFilters(categoryName: entry.key),
            ),
          ],
          const SizedBox(height: 32),
        ],
      );
    }

    return HomeEmptyState(
      onBrowse: () => _seeAll(),
      onRefresh: () => context.read<HomeCubit>().loadHome(isRefresh: true),
    );
  }

  Widget _fallbackSectionShimmer() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
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
        ),
        SizedBox(
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
      ],
    );
  }

  // ─── Empty / error states ─────────────────────────────────────────────────

  Widget _buildFullError(String message) {
    return EmptyStateWidget(
      icon: Icons.wifi_off_rounded,
      title: 'Connection Failed',
      subtitle: message.isNotEmpty ? message : 'Could not load content. Please check your internet connection.',
      actionLabel: 'Try Again',
      onAction: () => context.read<HomeCubit>().loadHome(isRefresh: true),
      iconColor: const Color(AppColors.textMuted),
    );
  }

  Widget _buildQuickCategoryChips() {
    final categories = [
      ('News', Icons.newspaper_rounded, const Color(0xFF0EA5E9)),
      ('Sports', Icons.sports_cricket_rounded, const Color(0xFFFF5722)),
      ('Entertainment', Icons.theaters_rounded, const Color(0xFFF59E0B)),
      ('Movies', Icons.movie_rounded, const Color(0xFF8B5CF6)),
      ('Kids', Icons.child_care_rounded, const Color(0xFF06B6D4)),
      ('Music', Icons.music_note_rounded, const Color(0xFFEC4899)),
      ('Doordarshan', Icons.cell_tower_rounded, const Color(0xFFE11D48)),
      ('Devotional', Icons.auto_awesome_rounded, const Color(0xFFFF8F00)),
      ('Regional', Icons.language_rounded, const Color(0xFF10B981)),
    ];

    return SizedBox(
      height: 38,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        itemBuilder: (context, index) {
          final cat = categories[index];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => _seeAll(categoryName: cat.$1),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(AppColors.surfaceElevated),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(AppColors.divider).withOpacity(0.5),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(cat.$2, size: 16, color: cat.$3),
                        const SizedBox(width: 6),
                        Text(
                          cat.$1,
                          style: const TextStyle(
                            color: Color(AppColors.textPrimary),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── Category ordering helpers ────────────────────────────────────────────

  List<HomeCategorySection> _orderSections(List<HomeCategorySection> sections) {
    const order = <String, int>{
      'news': 1,
      'sports': 2,
      'sport': 2,
      'cricket': 2,
      'entertainment': 3,
      'movies': 4,
      'movie': 4,
      'film': 4,
      'kids': 5,
      'cartoon': 5,
      'music': 6,
      'doordarshan': 7,
      'dd': 7,
      'devotional': 8,
      'religion': 8,
      'regional': 9,
      'international': 10,
    };
    final sorted = List<HomeCategorySection>.from(sections);
    sorted.sort((a, b) {
      final ai = order[a.name.toLowerCase()] ?? 1000;
      final bi = order[b.name.toLowerCase()] ?? 1000;
      if (ai != bi) return ai.compareTo(bi);
      return a.sortOrder.compareTo(b.sortOrder);
    });
    return sorted;
  }

  List<MapEntry<String, List<ChannelModel>>> _orderCategoryEntries(
    Map<String, List<ChannelModel>> byCategory,
  ) {
    const order = <String, int>{
      'news': 1,
      'sports': 2,
      'sport': 2,
      'cricket': 2,
      'entertainment': 3,
      'movies': 4,
      'movie': 4,
      'film': 4,
      'kids': 5,
      'cartoon': 5,
      'music': 6,
      'doordarshan': 7,
      'dd': 7,
      'devotional': 8,
      'religion': 8,
      'regional': 9,
      'international': 10,
    };
    final entries = byCategory.entries.toList();
    entries.sort((a, b) {
      final ai = order[a.key.toLowerCase()] ?? 1000;
      final bi = order[b.key.toLowerCase()] ?? 1000;
      if (ai != bi) return ai.compareTo(bi);
      return a.key.compareTo(b.key);
    });
    return entries;
  }

  // ─── Category icon / color helpers ────────────────────────────────────────

  IconData _categoryIcon(String name) {
    final n = name.toLowerCase();
    if (n.contains('news')) return Icons.newspaper_rounded;
    if (n.contains('movie') || n.contains('cinema')) return Icons.movie_rounded;
    if (n.contains('sport') || n.contains('cricket')) return Icons.sports_cricket_rounded;
    if (n.contains('music') || n.contains('song')) return Icons.music_note_rounded;
    if (n.contains('entertain') || n.contains('drama')) return Icons.theaters_rounded;
    if (n.contains('devotion') || n.contains('spiritual') || n.contains('religion')) return Icons.auto_awesome_rounded;
    if (n.contains('kids') || n.contains('cartoon') || n.contains('child')) return Icons.child_care_rounded;
    if (n.contains('language') || n.contains('regional')) return Icons.language_rounded;
    return Icons.live_tv_rounded;
  }

  Color _categoryColor(String name) {
    final n = name.toLowerCase();
    if (n.contains('news')) return const Color(0xFF0EA5E9);
    if (n.contains('movie') || n.contains('cinema')) return const Color(0xFF8B5CF6);
    if (n.contains('sport') || n.contains('cricket')) return const Color(0xFF10B981);
    if (n.contains('music') || n.contains('song')) return const Color(0xFFEC4899);
    if (n.contains('entertain') || n.contains('drama')) return const Color(0xFFF59E0B);
    if (n.contains('devotion') || n.contains('spiritual')) return const Color(0xFFFF8F00);
    if (n.contains('kids')) return const Color(0xFF06B6D4);
    return const Color(AppColors.primary);
  }
}
