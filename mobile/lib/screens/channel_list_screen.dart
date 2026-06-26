import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/channel_logo.dart';
import 'player_screen.dart';

class ChannelListScreen extends StatefulWidget {
  const ChannelListScreen({super.key});

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

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    context.read<ChannelCubit>().loadChannels(isRefresh: true, workingOnly: _workingOnly);
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
    );
  }

  /// Category selected — use categoryId for exact backend matching
  void _onCategorySelected(int? catId, String? catName) {
    setState(() {
      _selectedCategoryId = catId;
      _selectedCategoryName = catName;
    });
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      categoryId: catId ?? 0,
      language: _selectedLanguage ?? '',
    );
  }

  void _onLanguageSelected(String? lang) {
    setState(() => _selectedLanguage = lang);
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      categoryId: _selectedCategoryId ?? 0,
      language: lang ?? '',
    );
  }

  void _clearAllFilters() {
    setState(() {
      _searchController.clear();
      _selectedCategoryId = null;
      _selectedCategoryName = null;
      _selectedLanguage = null;
      _workingOnly = true;
    });
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      query: '',
      workingOnly: true,
      categoryId: 0,
      language: '',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: BlocBuilder<ChannelCubit, ChannelState>(
          builder: (context, state) {
            if (state is ChannelLoading) return _buildShimmerGrid();
            if (state is ChannelError) {
              return _buildErrorWidget(state.message,
                () => context.read<ChannelCubit>().loadChannels(isRefresh: true, workingOnly: _workingOnly));
            }
            if (state is ChannelLoaded) return _buildChannelList(state);
            return _buildShimmerGrid();
          },
        ),
      ),
    );
  }

  Widget _buildChannelList(ChannelLoaded state) {
    final channels = state.channels;
    final categories = state.categories;
    final languages = state.languages;
    final hasFilters = _selectedCategoryId != null || _selectedLanguage != null;

    return CustomScrollView(
      controller: _scrollController,
      physics: const BouncingScrollPhysics(),
      slivers: [
        // Title
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 4),
            child: Text(
              'Live TV',
              style: TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
          ),
        ),

        // Search bar
        SliverToBoxAdapter(child: _buildSearchBar()),

        // Working Only toggle
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Working Only',
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                    Text(
                      _workingOnly
                          ? 'Showing playable channels'
                          : 'Showing all channels including offline',
                      style: const TextStyle(color: Color(AppColors.textMuted), fontSize: 11),
                    ),
                  ],
                ),
                Switch(
                  value: _workingOnly,
                  onChanged: _toggleWorkingOnly,
                  activeColor: const Color(AppColors.primary),
                ),
              ],
            ),
          ),
        ),

        // Category chips
        SliverToBoxAdapter(child: _buildCategoryChips(categories)),

        // Language chips
        if (languages.isNotEmpty)
          SliverToBoxAdapter(child: _buildLanguageChips(languages)),

        // Channel count + filter info
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _workingOnly
                      ? '${state.totalCount} working channels'
                      : '${state.totalCount} channels',
                  style: const TextStyle(
                    color: Color(AppColors.textMuted),
                    fontSize: 12,
                  ),
                ),
                if (_workingOnly && hasFilters)
                  const Padding(
                    padding: EdgeInsets.only(top: 3),
                    child: Text(
                      'Some offline or unsupported channels are hidden.',
                      style: TextStyle(color: Color(AppColors.textMuted), fontSize: 11),
                    ),
                  ),
                if (!_workingOnly)
                  const Padding(
                    padding: EdgeInsets.only(top: 3),
                    child: Text(
                      'Offline and unstable channels may appear.',
                      style: TextStyle(color: Color(0xFFFF9800), fontSize: 11),
                    ),
                  ),
              ],
            ),
          ),
        ),

        // Grid or empty state
        if (channels.isEmpty)
          SliverFillRemaining(child: _buildEmptyWidget())
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.80,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) => _buildChannelCard(channels[index]),
                childCount: channels.length,
              ),
            ),
          ),

        // Loading more indicator
        if (state.isLoadingMore)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(16.0),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),

        // Error banner (still showing cached data)
        if (state.error != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF2C1010),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(AppColors.primary).withOpacity(0.3)),
                ),
                child: Text(
                  state.error!,
                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: TextField(
        controller: _searchController,
        style: const TextStyle(color: Colors.white, fontSize: 15),
        decoration: InputDecoration(
          hintText: 'Search channels...',
          hintStyle: const TextStyle(color: Color(AppColors.textMuted), fontSize: 14),
          prefixIcon: const Icon(Icons.search_rounded, color: Color(AppColors.textSecondary), size: 20),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                  onPressed: () {
                    _searchController.clear();
                    _onSearchChanged('');
                  },
                )
              : null,
          filled: true,
          fillColor: const Color(AppColors.surface),
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF2E2E2E), width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(AppColors.primary), width: 1.5),
          ),
        ),
        onChanged: _onSearchChanged,
      ),
    );
  }

  Widget _buildCategoryChips(List<CategoryModel> categories) {
    if (categories.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 44,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _buildChip(
              'All',
              _selectedCategoryId == null,
              () => _onCategorySelected(null, null),
            );
          }
          final cat = categories[index - 1];
          final isSelected = _selectedCategoryId == cat.id;
          final label = cat.channelCount > 0 ? '${cat.name} (${cat.channelCount})' : cat.name;
          return _buildChip(
            label,
            isSelected,
            () => _onCategorySelected(isSelected ? null : cat.id, isSelected ? null : cat.name),
          );
        },
      ),
    );
  }

  Widget _buildLanguageChips(List<LanguageModel> languages) {
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: languages.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _buildChip(
              'All',
              _selectedLanguage == null,
              () => _onLanguageSelected(null),
            );
          }
          final lang = languages[index - 1];
          final isSelected = _selectedLanguage?.toLowerCase() == lang.name.toLowerCase();
          return _buildChip(
            lang.name,
            isSelected,
            () => _onLanguageSelected(isSelected ? null : lang.name),
          );
        },
      ),
    );
  }

  Widget _buildChip(String label, bool isSelected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 8, top: 4, bottom: 4),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? const Color(AppColors.primary) : const Color(AppColors.surface),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? const Color(AppColors.primary) : const Color(0xFF333333),
              width: 1,
            ),
            boxShadow: isSelected
                ? [BoxShadow(
                    color: const Color(AppColors.primary).withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  )]
                : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              color: isSelected ? Colors.white : const Color(AppColors.textSecondary),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildChannelCard(ChannelModel channel) {
    final detailText = [channel.language, channel.quality ?? 'SD']
        .whereType<String>()
        .where((e) => e.trim().isNotEmpty)
        .join(' • ');

    final healthBadge = _buildHealthBadge(channel.healthStatus);

    return GestureDetector(
      onTap: () => _openPlayer(channel),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF282828), width: 0.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            // LIVE badge top-right
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF1744), Color(0xFFE50914)],
                  ),
                  borderRadius: BorderRadius.circular(4),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFE50914).withOpacity(0.4),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: const Text(
                  'LIVE',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ),

            // Health status badge (bottom-left)
            if (healthBadge != null)
              Positioned(
                bottom: 8,
                left: 8,
                child: healthBadge,
              ),

            // Premium badge (top-left)
            if (channel.isPremium)
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFB300),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'PRO',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),

            // Content
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 18, 12, 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: const Color(0xFF383838), width: 1.5),
                    ),
                    child: ChannelLogo(
                      logoUrl: channel.logoUrl,
                      localLogoUrl: channel.localLogoUrl,
                      channelName: channel.name,
                      size: 60,
                      borderRadius: 10,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    channel.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      letterSpacing: -0.1,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                  if (channel.categoryName != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      channel.categoryName!,
                      style: const TextStyle(
                        color: Color(AppColors.textSecondary),
                        fontSize: 11,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                  if (detailText.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      detailText,
                      style: const TextStyle(
                        color: Color(AppColors.textMuted),
                        fontSize: 10,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
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

  /// Returns a small coloured badge for the channel's health status.
  /// Returns null for 'online' (no badge needed — it's the default good state).
  Widget? _buildHealthBadge(String? healthStatus) {
    if (healthStatus == null) return null;
    final h = healthStatus.toLowerCase();

    Color color;
    String label;

    switch (h) {
      case 'online':
        return null; // clean — no badge
      case 'unstable':
        color = const Color(0xFFFF9800);
        label = 'Unstable';
        break;
      case 'offline':
      case 'dead':
        color = const Color(0xFFF44336);
        label = 'Offline';
        break;
      case 'drm_or_unsupported':
        color = const Color(0xFF9E9E9E);
        label = 'Unsupported';
        break;
      case 'geo_blocked':
        color = const Color(0xFF9E9E9E);
        label = 'Geo-Blocked';
        break;
      case 'requires_licensed_source':
        color = const Color(0xFF9C27B0);
        label = 'Source Req.';
        break;
      default:
        return null; // unknown / not checked — no badge
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.85),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white),
      ),
    );
  }

  void _openPlayer(ChannelModel channel) {
    final allChannels = context.read<ChannelCubit>().allChannels;
    final index = allChannels.indexWhere((c) => c.id == channel.id);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PlayerScreen(
          channel: channel,
          channels: allChannels,
          initialIndex: index >= 0 ? index : 0,
        ),
      ),
    );
  }

  Widget _buildShimmerGrid() {
    return CustomScrollView(
      slivers: [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Text(
              'Live TV',
              style: TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.80,
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
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              childCount: 8,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorWidget(String message, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 64, color: Colors.white24),
            const SizedBox(height: 20),
            const Text(
              'Unable to load channels',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(color: Colors.white38, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppColors.primary),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    final hasActiveFilters = _selectedCategoryId != null ||
        _selectedLanguage != null ||
        _searchController.text.isNotEmpty;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.tv_off_rounded, size: 56, color: Colors.white24),
            const SizedBox(height: 16),
            Text(
              hasActiveFilters ? 'No channels match your filters' : 'No channels found',
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _workingOnly
                  ? 'Some channels may be offline or require a specific source.'
                  : 'Try adjusting your filters.',
              style: const TextStyle(color: Colors.white30, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            if (hasActiveFilters) ...[
              const SizedBox(height: 24),
              TextButton(
                onPressed: _clearAllFilters,
                child: const Text(
                  'Clear Filters',
                  style: TextStyle(color: Color(AppColors.primary)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
