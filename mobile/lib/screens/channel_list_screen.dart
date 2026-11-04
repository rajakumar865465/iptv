import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/favorite_cubit.dart';
import '../cubits/mini_player_cubit.dart';
import '../cubits/license_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/premium_widgets.dart';
import '../widgets/premium_channel_card.dart';
import '../widgets/live_tv/channel_directory_row.dart';
import '../widgets/live_tv/live_tv_app_bar.dart';
import '../widgets/live_tv/live_tv_empty_state.dart';
import '../widgets/live_tv/live_tv_filter_sheet.dart';
import '../widgets/live_tv/live_tv_search_bar.dart';
import '../widgets/live_tv/live_tv_skeleton.dart';
import '../widgets/live_tv/working_only_toggle.dart';
import 'player_screen.dart';

/// A header row inside the directory list (a letter section like "A" or a
/// genre block like "News"). Rows themselves are plain [ChannelModel]s, so the
/// flattened directory is a `List<Object>` of headers + channels.
class _HeaderEntry {
  final String label;
  const _HeaderEntry(this.label);
}

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

  // Deep-link / fine category facet (distinct from the coarse 9-genre facet).
  int? _selectedCategoryId;
  String? _selectedCategoryName;

  // Directory facets (mirror ChannelCubit state so the sheet reflects reality).
  String? _genre;
  String? _language;
  String? _country;
  String? _quality;
  String _premium = 'all';

  bool _workingOnly = true;
  String _selectedSort = 'az';

  // The 9 permanent genre super-blocks, in display order (matches backend
  // channelNumbering.js). Channel-Number sort groups rows under these headers.
  static const List<String> _genreOrder = [
    'News', 'Entertainment', 'Movies', 'Sports', 'Music',
    'Kids', 'Regional', 'Devotional', 'International', 'Other',
  ];

  // Sort menu per spec: A–Z (default) · Channel Number · Most Watched ·
  // Recently Added · Recently Updated.
  static const _sortOptions = [
    ('az', 'A–Z', Icons.sort_by_alpha_rounded),
    ('number', 'Channel Number', Icons.format_list_numbered_rounded),
    ('watched', 'Most Watched', Icons.local_fire_department_rounded),
    ('recent', 'Recently Added', Icons.fiber_new_rounded),
    ('updated', 'Recently Updated', Icons.update_rounded),
  ];

  static const Set<String> _validSorts = {
    'az', 'number', 'watched', 'recent', 'updated',
  };

  @override
  void initState() {
    super.initState();
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
      _language = widget.initialLanguage;
      _searchController.text = '';
    } else {
      _selectedCategoryId = cubit.filterCategoryId;
      _selectedCategoryName = cubit.filterCategoryName;
      _language = cubit.filterLanguage;
      _genre = cubit.genreFilter;
      _country = cubit.countryFilter;
      _quality = cubit.qualityFilter;
      _premium = cubit.premiumFilter;
      _workingOnly = cubit.workingOnly;
      _selectedSort = _validSorts.contains(cubit.sortBy) ? cubit.sortBy : 'az';
      _searchController.text = cubit.currentQuery;
    }

    _reload();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  /// Single entry point for (re)loading the directory. Always a full fetch
  /// (`paginate:false`) so we get the complete, server-sorted set needed to
  /// build A–Z / genre sections and the quick strips client-side.
  Future<void> _reload() {
    return context.read<ChannelCubit>().loadChannels(
          isRefresh: true,
          paginate: false,
          query: _searchController.text,
          workingOnly: _workingOnly,
          categoryId: _selectedCategoryId ?? 0,
          language: _language ?? '',
          genre: _genre ?? '',
          country: _country ?? '',
          quality: _quality ?? '',
          premiumFilter: _premium,
          sortBy: _selectedSort,
        );
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      if (!mounted) return;
      // Rebuild so quick sections hide/show as the query becomes (non-)empty.
      setState(() {});
      _reload();
    });
  }

  void _toggleWorkingOnly(bool value) {
    setState(() => _workingOnly = value);
    _reload();
  }

  void _onSortChanged(String sort) {
    if (_selectedSort == sort) return;
    setState(() => _selectedSort = sort);
    _reload();
  }

  void _openFilterSheet(ChannelLoaded state) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => LiveTvFilterSheet(
        initial: LiveTvFilters(
          genre: _genre,
          language: _language,
          country: _country,
          quality: _quality,
          premiumFilter: _premium,
        ),
        languages: _orderLanguages(state.languages),
        countries: _countriesFrom(state),
        onApply: _applyFilters,
      ),
    );
  }

  void _applyFilters(LiveTvFilters f) {
    setState(() {
      _genre = f.genre;
      _language = f.language;
      _country = f.country;
      _quality = f.quality;
      _premium = f.premiumFilter;
    });
    _reload();
  }

  void _clearAllFilters() {
    setState(() {
      _searchController.clear();
      _selectedCategoryId = null;
      _selectedCategoryName = null;
      _language = null;
      _genre = null;
      _country = null;
      _quality = null;
      _premium = 'all';
    });
    _reload();
  }

  bool get _hasSearch => _searchController.text.trim().isNotEmpty;

  bool get _hasActiveFilters =>
      _selectedCategoryId != null ||
      _language != null ||
      _genre != null ||
      _country != null ||
      _quality != null ||
      _premium != 'all';

  bool get _hasNonGenreActiveFilters =>
      _selectedCategoryId != null ||
      _language != null ||
      _country != null ||
      _quality != null ||
      _premium != 'all';

  List<String> _countriesFrom(ChannelLoaded state) {
    final set = <String>{};
    for (final c in state.channels) {
      final co = c.country;
      if (co != null && co.trim().isNotEmpty) set.add(co.trim());
    }
    final list = set.toList()..sort();
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg(context),
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
                onAction: _reload,
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
    final showQuick = !_hasSearch && !_hasActiveFilters;
    final entries = _buildEntries(channels, _selectedSort);

    final licenseState = context.read<LicenseCubit>().state;
    final bool hasPro = licenseState is LicenseActive && licenseState.license.hasProAccess;
    final bool hasPlus = licenseState is LicenseActive && licenseState.license.hasPlusAccess;

    bool isChannelLocked(ChannelModel c) {
      if (c.channelTier == 'free') return false;
      if (c.channelTier == 'plus' && !hasPlus) return true;
      if (c.channelTier == 'pro' && !hasPro) return true;
      return false;
    }

    return RefreshIndicator(
      color: const Color(AppColors.primary),
      backgroundColor: const Color(AppColors.surface),
      onRefresh: _reload,
      child: CustomScrollView(
        controller: _scrollController,
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverToBoxAdapter(
            child: LiveTvAppBar(
              channelCount: state.totalCount,
              selectedSort: _selectedSort,
              sortOptions: _sortOptions,
              onSortChanged: _onSortChanged,
              onFilterTap: () => _openFilterSheet(state),
            ),
          ),

          SliverToBoxAdapter(
            child: LiveTvSearchBar(
              controller: _searchController,
              onChanged: _onSearchChanged,
            ),
          ),

          // Quick horizontal Genre filter chip bar
          SliverToBoxAdapter(
            child: _buildGenreQuickBar(),
          ),

          // Unified status & Working Only pill bar
          SliverToBoxAdapter(
            child: WorkingOnlyToggle(
              value: _workingOnly,
              onChanged: _toggleWorkingOnly,
              channelCount: state.totalCount,
              showClearFilters: _hasActiveFilters || _hasSearch,
              onClearFilters: _clearAllFilters,
            ),
          ),

          // Active filter chips (only when non-genre facets are narrowing).
          if (_hasNonGenreActiveFilters)
            SliverToBoxAdapter(child: _buildActiveFilterBar()),

          // Cached-data error banner
          if (state.error != null)
            SliverToBoxAdapter(child: ErrorBanner(state.error!)),

          if (channels.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: LiveTvEmptyState(
                hasFilters: _hasActiveFilters || _hasSearch,
                workingOnly: _workingOnly,
                onResetFilters:
                    (_hasActiveFilters || _hasSearch) ? _clearAllFilters : null,
                onToggleWorkingOnly:
                    _workingOnly ? () => _toggleWorkingOnly(false) : null,
              ),
            )
          else ...[
            // Quick discovery strips — pinned on top, hidden while searching/filtering.
            if (showQuick) ..._buildQuickSlivers(channels, isChannelLocked),

            if (showQuick)
              const SliverToBoxAdapter(
                child: SectionHeader(
                  title: 'All Channels',
                  icon: Icons.apps_rounded,
                ),
              ),

            // Main directory (sectioned by letter or genre, or flat for ranked sorts).
            SliverPadding(
              padding: const EdgeInsets.only(
                top: 4,
                bottom: AppConstants.bottomNavClearance,
              ),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final e = entries[index];
                    if (e is _HeaderEntry) return _buildSectionHeaderTile(e);
                    final channel = e as ChannelModel;
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                      child: ChannelDirectoryRow(
                        channel: channel,
                        isLocked: isChannelLocked(channel),
                        onTap: () {
                          if (isChannelLocked(channel)) {
                            // Show upgrade popup?
                            // Wait, the API returns 403 anyway, which might trigger an error.
                            // But maybe we should handle it gracefully here?
                            // Actually, just let it open the player, and the player will get the 403 and handle it.
                            _openPlayer(channel);
                          } else {
                            _openPlayer(channel);
                          }
                        },
                      ),
                    );
                  },
                  childCount: entries.length,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Directory section building ──────────────────────────────────────────

  /// Flatten [channels] into a `[header, row, row, header, row, …]` list.
  /// - `az`      → alphabetical, grouped by first letter ('#' for non-alpha).
  /// - `number`  → grouped by the 9 genre blocks, sorted by channel number.
  /// - other     → flat list in the server-provided ranked order (no headers).
  List<Object> _buildEntries(List<ChannelModel> channels, String sort) {
    if (channels.isEmpty) return const [];
    final entries = <Object>[];

    if (sort == 'number') {
      final sorted = List<ChannelModel>.from(channels)
        ..sort((a, b) {
          final an = a.channelNumber ?? 999999;
          final bn = b.channelNumber ?? 999999;
          if (an != bn) return an.compareTo(bn);
          return a.name.toLowerCase().compareTo(b.name.toLowerCase());
        });
      entries.addAll(sorted);
      return entries;
    }

    if (sort == 'az') {
      final sorted = List<ChannelModel>.from(channels)
        ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      String? current;
      for (final c in sorted) {
        final letter = _firstLetter(c.name);
        if (letter != current) {
          current = letter;
          entries.add(_HeaderEntry(letter));
        }
        entries.add(c);
      }
      return entries;
    }

    // watched / recent / updated → server already sorted; flat list.
    entries.addAll(channels);
    return entries;
  }

  String _firstLetter(String name) {
    final t = name.trim();
    if (t.isEmpty) return '#';
    final ch = t[0].toUpperCase();
    return RegExp(r'[A-Z]').hasMatch(ch) ? ch : '#';
  }

  IconData _genreIcon(String g) {
    switch (g) {
      case 'News':
        return Icons.newspaper_rounded;
      case 'Entertainment':
        return Icons.movie_filter_rounded;
      case 'Movies':
        return Icons.local_movies_rounded;
      case 'Sports':
        return Icons.sports_cricket_rounded;
      case 'Music':
        return Icons.music_note_rounded;
      case 'Kids':
        return Icons.child_care_rounded;
      case 'Regional':
        return Icons.translate_rounded;
      case 'Devotional':
        return Icons.self_improvement_rounded;
      case 'International':
        return Icons.public_rounded;
      default:
        return Icons.tv_rounded;
    }
  }

  Widget _buildSectionHeaderTile(_HeaderEntry h) {
    final isSymbol = h.label == '#';
    final displayText = isSymbol ? '0–9 & Symbols' : h.label.toUpperCase();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: isSymbol ? 10 : 9,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(AppColors.primary).withOpacity(0.18)
                  : const Color(0xFFEEF2FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isDark
                    ? const Color(AppColors.primary).withOpacity(0.35)
                    : const Color(0xFFC7D2FE),
                width: 0.8,
              ),
            ),
            child: Text(
              displayText,
              style: TextStyle(
                color: isDark
                    ? const Color(AppColors.primaryLight)
                    : const Color(0xFF4338CA),
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              height: 1,
              color: AppColors.div(context),
            ),
          ),
        ],
      ),
    );
  }

  // ── Quick discovery strips ────────────────────────────────────────────────

  List<Widget> _buildQuickSlivers(List<ChannelModel> channels, bool Function(ChannelModel) isLocked) {
    final widgets = <Widget>[];

    // ⭐ Favourites — from FavoriteCubit (hidden when empty).
    widgets.add(
      SliverToBoxAdapter(
        child: BlocBuilder<FavoriteCubit, FavoriteState>(
          builder: (context, favState) {
            if (favState is! FavoriteLoaded || favState.favorites.isEmpty) {
              return const SizedBox.shrink();
            }
            return _buildQuickStrip(
              'Favourites',
              Icons.star_rounded,
              const Color(AppColors.premiumGold),
              favState.favorites.take(12).toList(),
              isLocked,
            );
          },
        ),
      ),
    );

    // 🔥 Compact Featured Strip (Most Watched) — capped at 8 channels to keep All Channels prominent
    final watched = List<ChannelModel>.from(channels)
      ..sort((a, b) => b.watchCount.compareTo(a.watchCount));
    if (watched.isNotEmpty && watched.first.watchCount > 0) {
      widgets.add(
        SliverToBoxAdapter(
          child: _buildQuickStrip(
            'Trending Now',
            Icons.local_fire_department_rounded,
            const Color(AppColors.warning),
            watched.take(8).toList(),
            isLocked,
          ),
        ),
      );
    }

    return widgets;
  }

  Widget _buildQuickStrip(
    String title,
    IconData icon,
    Color iconColor,
    List<ChannelModel> list,
    bool Function(ChannelModel) isLocked,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionHeader(title: title, icon: icon, iconColor: iconColor),
        SizedBox(
          height: 162,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
            itemCount: list.length,
            itemBuilder: (_, i) => PremiumChannelCard(
              channel: list[i],
              variant: PremiumChannelCardVariant.compact,
              isLocked: isLocked(list[i]),
              onTap: () => _openPlayer(list[i]),
            ),
          ),
        ),
      ],
    );
  }

  // ── Quick Genre filter bar & Active filter bar ────────────────────────────

  Widget _buildGenreQuickBar() {
    final genres = ['All', ..._genreOrder.where((g) => g != 'Other')];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(14, 2, 14, 2),
        itemCount: genres.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final g = genres[i];
          final isAll = g == 'All';
          final selected = isAll ? _genre == null : _genre == g;
          return GestureDetector(
            onTap: () {
              final next = isAll ? null : (selected ? null : g);
              if (_genre == next) return;
              setState(() => _genre = next);
              _reload();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
              decoration: BoxDecoration(
                gradient: selected
                    ? const LinearGradient(
                        colors: [
                          Color(AppColors.primary),
                          Color(AppColors.brandRed),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: selected ? null : AppColors.surfElevated(context),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected
                      ? Colors.transparent
                      : AppColors.div(context),
                  width: 0.9,
                ),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: const Color(AppColors.primary).withOpacity(0.32),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withOpacity(
                            Theme.of(context).brightness == Brightness.dark ? 0.2 : 0.04,
                          ),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isAll ? Icons.grid_view_rounded : _genreIcon(g),
                    size: 13.5,
                    color: selected
                        ? Colors.white
                        : AppColors.text2(context),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    g,
                    style: TextStyle(
                      color: selected
                          ? Colors.white
                          : AppColors.text1(context),
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildActiveFilterBar() {
    final chips = <Widget>[];

    if (_selectedCategoryName != null) {
      chips.add(_activeChip(_selectedCategoryName!, () {
        setState(() {
          _selectedCategoryId = null;
          _selectedCategoryName = null;
        });
        _reload();
      }));
    }
    if (_language != null) {
      chips.add(_activeChip(_language!, () {
        setState(() => _language = null);
        _reload();
      }));
    }
    if (_country != null) {
      chips.add(_activeChip(_country!.toUpperCase(), () {
        setState(() => _country = null);
        _reload();
      }));
    }
    if (_quality != null) {
      chips.add(_activeChip(_quality!.toUpperCase(), () {
        setState(() => _quality = null);
        _reload();
      }));
    }
    if (_premium != 'all') {
      chips.add(_activeChip(_premium == 'true' ? 'Premium' : 'Free', () {
        setState(() => _premium = 'all');
        _reload();
      }));
    }

    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 2),
        children: [
          for (final c in chips) ...[c, const SizedBox(width: 8)],
        ],
      ),
    );
  }

  Widget _activeChip(String label, VoidCallback onClear) {
    return GestureDetector(
      onTap: onClear,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 6, 8, 6),
        decoration: BoxDecoration(
          color: const Color(AppColors.primary).withOpacity(0.14),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(AppColors.primary).withOpacity(0.3),
            width: 0.8,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Color(AppColors.primary),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.close_rounded,
              size: 13,
              color: Color(AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }

  void _openPlayer(ChannelModel channel) {
    final allChannels = context.read<ChannelCubit>().allChannels;
    final index = allChannels.indexWhere((c) => c.id == channel.id);

    final filters = ChannelSourceFilters(
      categoryId: _selectedCategoryId,
      categoryName: _selectedCategoryName,
      language: _language,
      searchQuery: _searchController.text,
      workingOnly: _workingOnly,
      sort: _selectedSort,
      premium: _premium == 'all' ? null : _premium == 'true',
    );

    final PlayerSourceType sourceType =
        (_selectedCategoryId != null && _selectedCategoryId != 0)
            ? PlayerSourceType.category
            : (_searchController.text.isNotEmpty
                ? PlayerSourceType.search
                : PlayerSourceType.liveTv);

    context.read<MiniPlayerCubit>().play(
      channel,
      contextChannels: allChannels,
      initialIndex: index >= 0 ? index : 0,
      sourceType: sourceType,
      sourceFilters: filters,
    );
  }
}
