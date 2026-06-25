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
  
  String? _selectedCategory;
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
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      context.read<ChannelCubit>().loadChannels();
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      context.read<ChannelCubit>().loadChannels(
        isRefresh: true,
        query: query,
        workingOnly: _workingOnly,
        // keep current category/language filter active during search
      );
    });
  }

  void _toggleWorkingOnly(bool value) {
    setState(() => _workingOnly = value);
    context.read<ChannelCubit>().loadChannels(isRefresh: true, workingOnly: _workingOnly);
  }

  // Fix #11: Category and language filters now go to server, not client-side post-filter.
  // This ensures all pages are filtered correctly, not just the loaded page.
  void _onCategorySelected(String? cat) {
    setState(() => _selectedCategory = cat);
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      category: cat ?? '',
    );
  }

  void _onLanguageSelected(String? lang) {
    setState(() => _selectedLanguage = lang);
    context.read<ChannelCubit>().loadChannels(
      isRefresh: true,
      workingOnly: _workingOnly,
      language: lang ?? '',
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
            if (state is ChannelError) return _buildErrorWidget(state.message, () => context.read<ChannelCubit>().loadChannels(isRefresh: true));
            if (state is ChannelLoaded) {
              return _buildChannelList(state);
            }
            return _buildShimmerGrid();
          },
        ),
      ),
    );
  }

  Widget _buildChannelList(ChannelLoaded state) {
    final allChannels = state.channels;
    final categories  = state.categories;

    // Fix #11: Filtering is now fully server-side via API params.
    // No client-side post-filter — avoids missing channels across pages.
    final filtered = allChannels;

    // Build Indian language list from loaded channels (for chip display only)
    final indianLanguages = [
      'Hindi','English','Bengali','Tamil','Telugu','Malayalam','Kannada',
      'Marathi','Punjabi','Gujarati','Odia','Assamese','Urdu','Bhojpuri',
    ];
    final languages = allChannels
        .map((c) => c.language)
        .whereType<String>()
        .where((l) => l.trim().isNotEmpty && l.toLowerCase() != 'unknown')
        .toSet()
        .where((l) => indianLanguages.any((il) => il.toLowerCase() == l.toLowerCase()))
        .toList()..sort();

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
        // Filters Row (Working Only)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Working Only', style: TextStyle(color: Colors.white70, fontSize: 14)),
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
        SliverToBoxAdapter(child: _buildLanguageFilter(languages)),
        // Channel count
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Text(
              '${filtered.length} channels',
              style: const TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 12,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),
        ),
        // Grid or empty
        if (filtered.isEmpty)
          SliverFillRemaining(child: _buildEmptyWidget())
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.85,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) => _buildChannelCard(filtered[index]),
                childCount: filtered.length,
              ),
            ),
          ),
        if (state.isLoadingMore)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(16.0),
              child: Center(child: CircularProgressIndicator()),
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
    return SizedBox(
      height: 44,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _buildChip('All', _selectedCategory == null, () => _onCategorySelected(null));
          }
          final cat = categories[index - 1];
          return _buildChip(
            cat.name,
            _selectedCategory == cat.name,
            () => _onCategorySelected(cat.name == _selectedCategory ? null : cat.name),
          );
        },
      ),
    );
  }

  Widget _buildLanguageFilter(List<String> languages) {
    if (languages.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: languages.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _buildChip('All', _selectedLanguage == null, () => _onLanguageSelected(null));
          }
          final lang = languages[index - 1];
          return _buildChip(
            lang,
            _selectedLanguage == lang,
            () => _onLanguageSelected(lang == _selectedLanguage ? null : lang),
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
                ? [BoxShadow(color: const Color(AppColors.primary).withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2))]
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
        .where((e) => e != null && e.toString().trim().isNotEmpty)
        .join(' • ');

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
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.8),
                ),
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 18, 12, 12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo with ring
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
                      size: 64,
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

  void _openPlayer(ChannelModel channel) {
    final allChannels = context.read<ChannelCubit>().allChannels;
    final index = allChannels.indexWhere((c) => c.id == channel.id);
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PlayerScreen(
        channel: channel,
        channels: allChannels,
        initialIndex: index >= 0 ? index : 0,
      )),
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
              style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.85,
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
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.tv_off_rounded, size: 56, color: Colors.white24),
          const SizedBox(height: 16),
          const Text(
            'No channels found',
            style: TextStyle(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          const Text(
            'Try adjusting your filters',
            style: TextStyle(color: Colors.white30, fontSize: 13),
          ),
          const SizedBox(height: 24),
          TextButton(
            onPressed: () {
              setState(() {
                _searchController.clear();
                _selectedCategory = null;
                _selectedLanguage = null;
                _workingOnly = true;
              });
              context.read<ChannelCubit>().loadChannels(
                isRefresh: true,
                query: '',
                workingOnly: true,
                category: '',
                language: '',
              );
            },
            child: const Text('Clear Filters', style: TextStyle(color: Color(AppColors.primary))),
          ),
        ],
      ),
    );
  }
}
