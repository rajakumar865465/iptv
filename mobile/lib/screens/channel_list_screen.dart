import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/favorite_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/premium_widgets.dart';
import '../widgets/live_tv/filter_chip_row.dart';
import '../widgets/premium_channel_card.dart';
import '../widgets/live_tv/live_tv_app_bar.dart';
import '../widgets/live_tv/live_tv_empty_state.dart';
import '../widgets/live_tv/live_tv_search_bar.dart';
import '../widgets/live_tv/live_tv_skeleton.dart';
import '../widgets/live_tv/working_only_toggle.dart';
import 'player_screen.dart';

class ChannelListScreen extends StatefulWidget {
  final int? initialCategoryId;
  final String? initialCategoryName;
  final String? initialLanguage;

  const ChannelListScreen({
    super.key,
    this.initialCategoryId,
    this.initialCategoryName,
    this.initialLanguage,
  });

  @override
  State<ChannelListScreen> createState() => _ChannelListScreenState();
}

class _ChannelListScreenState extends State<ChannelListScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  Timer? _debounce;

  int? _selectedCategoryId;
  String? _selectedCategoryName;
  String? _selectedLanguage;
  bool _workingOnly = true;
  String _selectedSort = 'recommended';

  static const _sortOptions = [
    ('recommended', 'Recommended', Icons.recommend_rounded),
    ('popular', 'Popular First', Icons.local_fire_department_rounded),
    ('premium', 'Premium First', Icons.workspace_premium_rounded),
    ('az', 'A–Z', Icons.sort_by_alpha_rounded),
    ('recent', 'Recently Added', Icons.new_releases_rounded),
    ('quality', 'Best Quality', Icons.hd_rounded),
    ('stable', 'Most Stable', Icons.signal_cellular_alt_rounded),
  ];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    context.read<FavoriteCubit>().loadFavorites();

    final cubit = context.read<ChannelCubit>();

    // Widget constructor params take priority (e.g. deep-link into a category).
    // Otherwise restore from the cubit's in-memory state (survives tab switches,
    // resets on app restart — no persistence to disk).
    if (widget.initialCategoryId != null ||
        widget.initialCategoryName != null ||
        widget.initialLanguage != null) {
      _selectedCategoryId = widget.initialCategoryId;
      _selectedCategoryName = widget.initialCategoryName;
      _selectedLanguage = widget.initialLanguage;
    } else {
      _selectedCategoryId = cubit.filterCategoryId;
      _selectedCategoryName = cubit.filterCategoryName;
      // Restore language only when no category is active. If both were set, the
      // category takes priority and language resets so the chips reload correctly.
      _selectedLanguage = cubit.filterCategoryId == null ? cubit.filterLanguage : null;
      _workingOnly = cubit.workingOnly;
      _selectedSort = cubit.sortBy;
    }

    cubit.loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      categoryId: _selectedCategoryId ?? 0,
      language: _selectedLanguage ?? '',
      sortBy: _selectedSort,
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 300) {
      final cubit = context.read<ChannelCubit>();
      final state = cubit.state;
      if (state is ChannelLoaded && state.hasMore && !state.isLoadingMore) {
        cubit.loadChannels();
      }
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      context.read<ChannelCubit>().loadChannels(
        isRefresh: true,
        query: query,
        workingOnly: _workingOnly,
        sortBy: _selectedSort,
      );
    });
  }

  void _toggleWorkingOnly(bool value) {
    setState(() => _workingOnly = value);
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: value,
      categoryId: _selectedCategoryId ?? 0,
      language: _selectedLanguage ?? '',
      sortBy: _selectedSort,
    );
  }

  void _onCategorySelected(int? catId) {
    final name = catId == null ? null : _categoryNameForId(catId);
    // Changing category resets language — the language chips will reload filtered
    // by the new category, so the user picks a valid language from the fresh list.
    setState(() {
      _selectedCategoryId = catId;
      _selectedCategoryName = name;
      _selectedLanguage = null;
    });
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      categoryId: catId ?? 0,
      language: '',
      sortBy: _selectedSort,
    );
  }

  void _onLanguageSelected(String? lang) {
    // Language selection keeps the active category so you can refine within it.
    setState(() => _selectedLanguage = lang);
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      categoryId: _selectedCategoryId ?? 0,
      language: lang ?? '',
      sortBy: _selectedSort,
    );
  }

  void _onSortChanged(String sort) {
    if (_selectedSort == sort) return;
    setState(() => _selectedSort = sort);
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      categoryId: _selectedCategoryId ?? 0,
      language: _selectedLanguage ?? '',
      sortBy: sort,
    );
  }

  void _clearAllFilters() {
    setState(() {
      _searchController.clear();
      _selectedCategoryId = null;
      _selectedCategoryName = null;
      _selectedLanguage = null;
      _workingOnly = true;
      _selectedSort = 'recommended';
    });
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      query: '',
      workingOnly: true,
      categoryId: 0,
      language: '',
      sortBy: 'recommended',
    );
  }

  String? _categoryNameForId(int id) {
    final state = context.read<ChannelCubit>().state;
    if (state is! ChannelLoaded) return null;
    return state.categories
        .where((c) => c.id == id)
        .firstOrNull
        ?.name;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: BlocBuilder<ChannelCubit, ChannelState>(
          builder: (context, state) {
            if (state is ChannelLoading) return const LiveTvSkeleton();
            if (state is ChannelError) {
              return EmptyStateWidget(
                icon: Icons.wifi_off_rounded,
                title: 'Failed to Load Channels',
                subtitle: state.message,
                actionLabel: 'Retry',
                onAction: () => context
                    .read<ChannelCubit>()
                    .loadChannels(isRefresh: true, workingOnly: _workingOnly),
                iconColor: const Color(AppColors.textMuted),
              );
            }
            if (state is ChannelLoaded) return _buildContent(state);
            return const LiveTvSkeleton();
          },
        ),
      ),
    );
  }

  // Canonical language chip order (per product spec). Any language not listed
  // keeps its backend order after these; 'Unknown' always sorts last.
  static const List<String> _languageOrder = [
    'hindi', 'english', 'bengali', 'tamil', 'telugu', 'kannada', 'malayalam',
    'marathi', 'punjabi', 'gujarati', 'odia', 'assamese', 'urdu', 'bhojpuri',
    'sanskrit', 'nepali',
  ];

  List<LanguageModel> _orderLanguages(List<LanguageModel> langs) {
    int rank(String name) {
      final n = name.toLowerCase().trim();
      if (n == 'unknown') return 9999; // always last
      final i = _languageOrder.indexOf(n);
      return i >= 0 ? i : 500; // unlisted languages sit before Unknown
    }
    final sorted = List<LanguageModel>.from(langs);
    sorted.sort((a, b) {
      final ra = rank(a.name), rb = rank(b.name);
      if (ra != rb) return ra.compareTo(rb);
      return b.channelCount.compareTo(a.channelCount);
    });
    return sorted;
  }

  Widget _buildContent(ChannelLoaded state) {
    final channels = state.channels;
    final categories = state.categories;
    final languages = _orderLanguages(state.languages);
    final hasFilters = _selectedCategoryId != null ||
        _selectedLanguage != null ||
        _searchController.text.isNotEmpty;

    return RefreshIndicator(
      color: const Color(AppColors.primary),
      backgroundColor: const Color(AppColors.surface),
      onRefresh: () => context.read<ChannelCubit>().loadChannels(
        isRefresh: true,
        workingOnly: _workingOnly,
        categoryId: _selectedCategoryId ?? 0,
        language: _selectedLanguage ?? '',
        sortBy: _selectedSort,
      ),
      child: CustomScrollView(
        controller: _scrollController,
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          // App bar
          SliverToBoxAdapter(
            child: LiveTvAppBar(
              channelCount: state.totalCount,
              selectedSort: _selectedSort,
              sortOptions: _sortOptions,
              onSortChanged: _onSortChanged,
            ),
          ),

          // Search
          SliverToBoxAdapter(
            child: LiveTvSearchBar(
              controller: _searchController,
              onChanged: _onSearchChanged,
            ),
          ),

          // Working only toggle
          SliverToBoxAdapter(
            child: WorkingOnlyToggle(
              value: _workingOnly,
              onChanged: _toggleWorkingOnly,
            ),
          ),

          // Category chips
          if (categories.isNotEmpty)
            SliverToBoxAdapter(
              child: FilterChipRow<int>(
                items: [
                  FilterChipItem<int>(
                    value: null,
                    label: 'All',
                    selected: _selectedCategoryId == null,
                  ),
                  ...categories.map((cat) => FilterChipItem<int>(
                        value: cat.id,
                        label: cat.name,
                        count: cat.channelCount,
                        selected: _selectedCategoryId == cat.id,
                      )),
                ],
                onSelected: _onCategorySelected,
              ),
            ),

          // Language chips
          if (languages.isNotEmpty)
            SliverToBoxAdapter(
              child: FilterChipRow<String>(
                items: [
                  FilterChipItem<String>(
                    value: null,
                    label: 'All Lang',
                    selected: _selectedLanguage == null,
                  ),
                  ...languages.map((lang) => FilterChipItem<String>(
                        value: lang.name,
                        label: lang.name,
                        count: lang.channelCount,
                        selected: _selectedLanguage?.toLowerCase() ==
                            lang.name.toLowerCase(),
                      )),
                ],
                onSelected: _onLanguageSelected,
              ),
            ),

          // Count bar
          SliverToBoxAdapter(child: _buildCountBar(state, hasFilters)),

          // Error banner (cached data)
          if (state.error != null)
            SliverToBoxAdapter(child: ErrorBanner(state.error!)),

          // Grid or empty
          if (channels.isEmpty)
            SliverFillRemaining(
              child: LiveTvEmptyState(
                hasFilters: hasFilters,
                workingOnly: _workingOnly,
                onResetFilters: hasFilters ? _clearAllFilters : null,
                onToggleWorkingOnly: _workingOnly
                    ? () => _toggleWorkingOnly(false)
                    : null,
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.72,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) => PremiumChannelCard(
                    channel: channels[index],
                    variant: PremiumChannelCardVariant.grid,
                    showFavorite: true,
                    onTap: () => _openPlayer(channels[index]),
                  ),
                  childCount: channels.length,
                ),
              ),
            ),

          // Loading more
          if (state.isLoadingMore)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: const Color(AppColors.primary),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCountBar(ChannelLoaded state, bool hasFilters) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 6),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: _workingOnly
                  ? const Color(AppColors.success)
                  : const Color(AppColors.warning),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 7),
          Text(
            '${state.totalCount} ${_workingOnly ? 'working' : 'total'} channels',
            style: const TextStyle(
              color: Color(AppColors.textMuted),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 8),
          if (hasFilters)
            GestureDetector(
              onTap: _clearAllFilters,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(AppColors.brandRed).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(AppColors.brandRed).withOpacity(0.2),
                    width: 0.5,
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.close_rounded,
                      size: 11,
                      color: Color(AppColors.brandRed),
                    ),
                    SizedBox(width: 4),
                    Text(
                      'Clear Filters',
                      style: TextStyle(
                        color: Color(AppColors.brandRed),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _openPlayer(ChannelModel channel) {
    final allChannels = context.read<ChannelCubit>().allChannels;
    final index = allChannels.indexWhere((c) => c.id == channel.id);

    final filters = ChannelSourceFilters(
      categoryId: _selectedCategoryId,
      categoryName: _selectedCategoryName,
      language: _selectedLanguage,
      searchQuery: _searchController.text,
      workingOnly: _workingOnly,
      sort: _selectedSort,
    );

    final PlayerSourceType sourceType =
        (_selectedCategoryId != null && _selectedCategoryId != 0)
            ? PlayerSourceType.category
            : (_searchController.text.isNotEmpty
                ? PlayerSourceType.search
                : PlayerSourceType.liveTv);

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PlayerScreen(
          channel: channel,
          channels: allChannels,
          initialIndex: index >= 0 ? index : 0,
          sourceType: sourceType,
          sourceFilters: filters,
        ),
      ),
    );
  }
}
