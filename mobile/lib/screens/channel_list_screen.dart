import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/channel_card.dart';
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
    ('recommended', 'Recommended'),
    ('popular', 'Popular First'),
    ('premium', 'Premium First'),
    ('az', 'A–Z'),
    ('recent', 'Recently Added'),
    ('quality', 'Best Quality'),
    ('stable', 'Most Stable'),
  ];

  @override
  void initState() {
    super.initState();
    _selectedCategoryId = widget.initialCategoryId;
    _selectedCategoryName = widget.initialCategoryName;
    _selectedLanguage = widget.initialLanguage;
    _scrollController.addListener(_onScroll);
    context.read<ChannelCubit>().loadChannels(
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
      sortBy: _selectedSort,
    );
  }

  void _onLanguageSelected(String? lang) {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      body: SafeArea(
        child: BlocBuilder<ChannelCubit, ChannelState>(
          builder: (context, state) {
            if (state is ChannelLoading) return _buildShimmer();
            if (state is ChannelError) {
              return _buildError(state.message,
                  () => context.read<ChannelCubit>().loadChannels(isRefresh: true, workingOnly: _workingOnly));
            }
            if (state is ChannelLoaded) return _buildContent(state);
            return _buildShimmer();
          },
        ),
      ),
    );
  }


  Widget _buildContent(ChannelLoaded state) {
    final channels = state.channels;
    final categories = state.categories;
    final languages = state.languages;
    final hasFilters = _selectedCategoryId != null || _selectedLanguage != null || _searchController.text.isNotEmpty;

    return RefreshIndicator(
      color: const Color(AppColors.primary),
      backgroundColor: const Color(AppColors.surface),
      onRefresh: () => context.read<ChannelCubit>().loadChannels(
        isRefresh: true, workingOnly: _workingOnly,
        categoryId: _selectedCategoryId ?? 0,
        language: _selectedLanguage ?? '',
        sortBy: _selectedSort,
      ),
      child: CustomScrollView(
        controller: _scrollController,
        physics: const BouncingScrollPhysics(),
        slivers: [
          // ─── Title ────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text('Live TV',
                      style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                  // Sort dropdown button
                  _SortButton(
                    current: _selectedSort,
                    options: _sortOptions,
                    onChanged: _onSortChanged,
                  ),
                ],
              ),
            ),
          ),

          // ─── Search ────────────────────────────────────────────────────
          SliverToBoxAdapter(child: _buildSearchBar()),

          // ─── Working only toggle ───────────────────────────────────────
          SliverToBoxAdapter(child: _buildWorkingToggle()),

          // ─── Category chips ────────────────────────────────────────────
          if (categories.isNotEmpty)
            SliverToBoxAdapter(child: _buildCategoryChips(categories)),

          // ─── Language chips ────────────────────────────────────────────
          if (languages.isNotEmpty)
            SliverToBoxAdapter(child: _buildLanguageChips(languages)),

          // ─── Channel count + filter info ───────────────────────────────
          SliverToBoxAdapter(child: _buildCountBar(state, hasFilters)),

          // ─── Error banner (cached data) ────────────────────────────────
          if (state.error != null)
            SliverToBoxAdapter(child: _buildErrorBanner(state.error!)),

          // ─── Grid ──────────────────────────────────────────────────────
          if (channels.isEmpty)
            SliverFillRemaining(child: _buildEmpty(hasFilters))
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
                  (context, index) => ChannelCard(
                    channel: channels[index],
                    onTap: () => _openPlayer(channels[index]),
                  ),
                  childCount: channels.length,
                ),
              ),
            ),

          // ─── Loading more ──────────────────────────────────────────────
          if (state.isLoadingMore)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator(color: Color(AppColors.primary))),
              ),
            ),
        ],
      ),
    );
  }


  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: TextField(
        controller: _searchController,
        style: const TextStyle(color: Colors.white, fontSize: 15),
        decoration: InputDecoration(
          hintText: 'Search channels…',
          hintStyle: const TextStyle(color: Color(AppColors.textMuted), fontSize: 14),
          prefixIcon: const Icon(Icons.search_rounded, color: Color(AppColors.textSecondary), size: 20),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                  onPressed: () { _searchController.clear(); _onSearchChanged(''); })
              : null,
          filled: true,
          fillColor: const Color(AppColors.surface),
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF2E2E2E), width: 1)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(AppColors.primary), width: 1.5)),
        ),
        onChanged: _onSearchChanged,
      ),
    );
  }

  Widget _buildWorkingToggle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Working Only', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
            Text(
              _workingOnly ? 'Showing playable channels' : 'Showing all channels including offline',
              style: const TextStyle(color: Color(AppColors.textMuted), fontSize: 11)),
          ]),
          Switch(value: _workingOnly, onChanged: _toggleWorkingOnly, activeColor: const Color(AppColors.primary)),
        ],
      ),
    );
  }

  Widget _buildCategoryChips(List<CategoryModel> categories) {
    return SizedBox(
      height: 44,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) return _chip('All', _selectedCategoryId == null, () => _onCategorySelected(null, null));
          final cat = categories[index - 1];
          final isSelected = _selectedCategoryId == cat.id;
          final label = cat.channelCount > 0 ? '${cat.name} (${cat.channelCount})' : cat.name;
          return _chip(label, isSelected,
              () => _onCategorySelected(isSelected ? null : cat.id, isSelected ? null : cat.name));
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
          if (index == 0) return _chip('All', _selectedLanguage == null, () => _onLanguageSelected(null));
          final lang = languages[index - 1];
          final isSelected = _selectedLanguage?.toLowerCase() == lang.name.toLowerCase();
          return _chip(lang.name, isSelected, () => _onLanguageSelected(isSelected ? null : lang.name));
        },
      ),
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 8, top: 4, bottom: 4),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? const Color(AppColors.primary) : const Color(AppColors.surface),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
                color: selected ? const Color(AppColors.primary) : const Color(0xFF333333), width: 1),
            boxShadow: selected
                ? [BoxShadow(color: const Color(AppColors.primary).withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2))]
                : null,
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected ? Colors.white : const Color(AppColors.textSecondary))),
        ),
      ),
    );
  }

  Widget _buildCountBar(ChannelLoaded state, bool hasFilters) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 4),
      child: Row(
        children: [
          Text('${state.totalCount} ${_workingOnly ? 'working' : ''} channels',
              style: const TextStyle(color: Color(AppColors.textMuted), fontSize: 12)),
          const SizedBox(width: 8),
          if (hasFilters)
            GestureDetector(
              onTap: _clearAllFilters,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(AppColors.primary).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text('Clear Filters',
                    style: TextStyle(color: Color(AppColors.primary), fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(String message) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF2C1010),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(AppColors.primary).withOpacity(0.3)),
      ),
      child: Row(children: [
        const Icon(Icons.wifi_off_rounded, size: 14, color: Colors.white38),
        const SizedBox(width: 8),
        Expanded(child: Text('Could not refresh. Showing saved channels.',
            style: const TextStyle(color: Colors.white54, fontSize: 11))),
      ]),
    );
  }


  Widget _buildEmpty(bool hasFilters) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.tv_off_rounded, size: 56, color: Colors.white24),
          const SizedBox(height: 16),
          Text(
            hasFilters ? 'No channels match your filters' : 'No channels found',
            style: const TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Text(
            _workingOnly
                ? 'Some channels may be offline or require a specific source.'
                : 'Try adjusting your filters.',
            style: const TextStyle(color: Colors.white30, fontSize: 13), textAlign: TextAlign.center),
          if (hasFilters) ...[
            const SizedBox(height: 24),
            TextButton(
              onPressed: _clearAllFilters,
              child: const Text('Clear Filters', style: TextStyle(color: Color(AppColors.primary))),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _buildError(String message, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.wifi_off_rounded, size: 64, color: Colors.white24),
          const SizedBox(height: 20),
          const Text('Unable to load channels',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(color: Colors.white38, fontSize: 13), textAlign: TextAlign.center),
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
        ]),
      ),
    );
  }

  Widget _buildShimmer() {
    return CustomScrollView(
      slivers: [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Text('Live TV',
                style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, childAspectRatio: 0.80, crossAxisSpacing: 12, mainAxisSpacing: 12),
            delegate: SliverChildBuilderDelegate(
              (_, __) => Shimmer.fromColors(
                baseColor: const Color(AppColors.shimmerBase),
                highlightColor: const Color(AppColors.shimmerHighlight),
                child: Container(
                    decoration: BoxDecoration(
                        color: const Color(AppColors.surface), borderRadius: BorderRadius.circular(16)))),
              childCount: 8),
          ),
        ),
      ],
    );
  }

  void _openPlayer(ChannelModel channel) {
    final allChannels = context.read<ChannelCubit>().allChannels;
    final index = allChannels.indexWhere((c) => c.id == channel.id);
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PlayerScreen(
        channel: channel, channels: allChannels, initialIndex: index >= 0 ? index : 0)),
    );
  }
}


// ─── Sort Button ──────────────────────────────────────────────────────────────

class _SortButton extends StatelessWidget {
  final String current;
  final List<(String, String)> options;
  final ValueChanged<String> onChanged;

  const _SortButton({required this.current, required this.options, required this.onChanged});

  String get _currentLabel {
    for (final o in options) {
      if (o.$1 == current) return o.$2;
    }
    return 'Recommended';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showSheet(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(AppColors.surface),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF333333), width: 1),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.sort_rounded, size: 15, color: Color(AppColors.textSecondary)),
          const SizedBox(width: 5),
          Text(_currentLabel,
              style: const TextStyle(color: Color(AppColors.textSecondary), fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(width: 3),
          const Icon(Icons.expand_more_rounded, size: 14, color: Color(AppColors.textSecondary)),
        ]),
      ),
    );
  }

  void _showSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1A),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          const Text('Sort Channels',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          ...options.map((o) => ListTile(
            leading: Icon(
              o.$1 == current ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
              color: o.$1 == current ? const Color(AppColors.primary) : Colors.white38,
              size: 20,
            ),
            title: Text(o.$2,
                style: TextStyle(
                  color: o.$1 == current ? const Color(AppColors.primary) : Colors.white,
                  fontWeight: o.$1 == current ? FontWeight.w600 : FontWeight.w400,
                  fontSize: 14,
                )),
            onTap: () {
              Navigator.pop(context);
              onChanged(o.$1);
            },
            dense: true,
          )),
          const SizedBox(height: 12),
        ]),
      ),
    );
  }
}
