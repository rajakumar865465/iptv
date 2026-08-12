import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../cubits/favorite_cubit.dart';
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
  final IconData? icon;
  const _HeaderEntry(this.label, {this.icon});
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

          SliverToBoxAdapter(
            child: WorkingOnlyToggle(
              value: _workingOnly,
              onChanged: _toggleWorkingOnly,
            ),
          ),

          // Active filter chips (only when narrowing).
          if (_hasActiveFilters)
            SliverToBoxAdapter(child: _buildActiveFilterBar()),

          // Count bar
          SliverToBoxAdapter(child: _buildCountBar(state)),

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
            if (showQuick) ..._buildQuickSlivers(channels),

            if (showQuick)
              const SliverToBoxAdapter(
                child: SectionHeader(
                  title: 'All Channels',
                  icon: Icons.apps_rounded,
                ),
              ),

            // Main directory (sectioned by letter or genre, or flat for ranked sorts).
            SliverPadding(
              padding: const EdgeInsets.only(top: 4, bottom: 28),
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
                        onTap: () => _openPlayer(channel),
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
      final byGenre = <String, List<ChannelModel>>{};
      for (final c in channels) {
        byGenre.putIfAbsent(_normGenre(c.genre), () => []).add(c);
      }
      final orderedGenres = <String>[
        ..._genreOrder.where(byGenre.containsKey),
        ...byGenre.keys.where((g) => !_genreOrder.contains(g)),
      ];
      for (final g in orderedGenres) {
        final list = byGenre[g]!
          ..sort((a, b) {
            final an = a.channelNumber, bn = b.channelNumber;
            if (an != null && bn != null && an != bn) return an.compareTo(bn);
            if (an != null && bn == null) return -1;
            if (an == null && bn != null) return 1;
            return a.name.toLowerCase().compareTo(b.name.toLowerCase());
          });
        entries.add(_HeaderEntry(g, icon: _genreIcon(g)));
        entries.addAll(list);
      }
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

  String _normGenre(String? g) {
    if (g == null || g.trim().isEmpty) return 'Other';
    final t = g.trim().toLowerCase();
    return _genreOrder.firstWhere(
      (x) => x.toLowerCase() == t,
      orElse: () => 'Other',
    );
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Row(
        children: [
          if (h.icon != null) ...[
            Icon(h.icon, size: 15, color: const Color(AppColors.primary)),
            const SizedBox(width: 8),
          ],
          Text(
            h.label.toUpperCase(),
            style: const TextStyle(
              color: Color(AppColors.textSecondary),
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              height: 1,
              color: const Color(AppColors.divider).withOpacity(0.6),
            ),
          ),
        ],
      ),
    );
  }

  // ── Quick discovery strips ────────────────────────────────────────────────

  List<Widget> _buildQuickSlivers(List<ChannelModel> channels) {
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
              favState.favorites.take(15).toList(),
            );
          },
        ),
      ),
    );

    // 🔥 Most Watched — derived client-side; hidden when nobody's watched yet.
    final watched = List<ChannelModel>.from(channels)
      ..sort((a, b) => b.watchCount.compareTo(a.watchCount));
    if (watched.isNotEmpty && watched.first.watchCount > 0) {
      widgets.add(
        SliverToBoxAdapter(
          child: _buildQuickStrip(
            'Most Watched',
            Icons.local_fire_department_rounded,
            const Color(AppColors.warning),
            watched.take(15).toList(),
          ),
        ),
      );
    }

    // 🆕 Recently Added — by created_at (hidden when no timestamps available).
    final recent = channels.where((c) => c.createdAt != null).toList()
      ..sort((a, b) => b.createdAt!.compareTo(a.createdAt!));
    if (recent.isNotEmpty) {
      widgets.add(
        SliverToBoxAdapter(
          child: _buildQuickStrip(
            'Recently Added',
            Icons.fiber_new_rounded,
            const Color(AppColors.success),
            recent.take(15).toList(),
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
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionHeader(title: title, icon: icon, iconColor: iconColor),
        SizedBox(
          height: 176,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
            itemCount: list.length,
            itemBuilder: (_, i) => PremiumChannelCard(
              channel: list[i],
              variant: PremiumChannelCardVariant.compact,
              onTap: () => _openPlayer(list[i]),
            ),
          ),
        ),
      ],
    );
  }

  // ── Active filter bar + count bar ─────────────────────────────────────────

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
    if (_genre != null) {
      chips.add(_activeChip(_genre!, () {
        setState(() => _genre = null);
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
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(18, 2, 18, 2),
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

  Widget _buildCountBar(ChannelLoaded state) {
    final showClear = _hasActiveFilters || _hasSearch;
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
          if (showClear)
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
                      'Clear All',
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
