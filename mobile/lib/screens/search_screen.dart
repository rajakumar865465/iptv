import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/license_cubit.dart';
import '../cubits/search_cubit.dart';
import '../cubits/mini_player_cubit.dart';
import '../models/channel_model.dart';
import '../widgets/premium_channel_card.dart';
import '../widgets/premium_widgets.dart';
import 'player_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with SingleTickerProviderStateMixin {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;
  bool _hasFocus = false;

  @override
  void initState() {
    super.initState();
    _searchController.text = context.read<SearchCubit>().lastQuery;
    _focusNode.addListener(() {
      setState(() => _hasFocus = _focusNode.hasFocus);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) {
        context.read<SearchCubit>().search(query);
      }
    });
    setState(() {});
  }

  void _clearSearch() {
    _searchController.clear();
    context.read<SearchCubit>().clear();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg(context),
      body: SafeArea(
        child: Column(
          children: [
            _buildSearchHeader(),
            const SizedBox(height: 4),
            Expanded(
              child: BlocBuilder<SearchCubit, SearchState>(
                builder: (context, state) {
                  if (state is SearchForceUpdateRequired) return _buildSearchLoading();
                  final query = _searchController.text.trim();
                  if (query.isEmpty) return _buildIdleState();
                  if (state is SearchLoading) return _buildSearchLoading();
                  if (state is SearchError) {
                    return EmptyStateWidget(
                      icon: Icons.wifi_off_rounded,
                      title: 'Search Failed',
                      subtitle: state.message,
                      actionLabel: 'Retry',
                      onAction: () => context
                          .read<SearchCubit>()
                          .search(query),
                      iconColor: AppColors.textM(context),
                    );
                  }
                  if (state is SearchLoaded) {
                    if (state.channels.isEmpty) return _buildNoResults(query);
                    return _buildResults(state.channels);
                  }
                  return _buildIdleState();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Search Header ──────────────────────────────────────────────────────────

  Widget _buildSearchHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Search',
            style: TextStyle(
              color: AppColors.text1(context),
              fontSize: 26,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: AppColors.surf(context),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: _hasFocus
                    ? const Color(AppColors.primary)
                    : AppColors.div(context),
                width: _hasFocus ? 1.5 : 1.0,
              ),
            ),
            child: Row(children: [
              Padding(
                padding: const EdgeInsets.only(left: 14),
                child: Icon(
                  Icons.search_rounded,
                  color: AppColors.textM(context),
                  size: 20,
                ),
              ),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  focusNode: _focusNode,
                  autofocus: false,
                  style: TextStyle(
                    color: AppColors.text1(context),
                    fontSize: 14.5,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Search channels, shows, movies…',
                    hintStyle: TextStyle(
                      color: AppColors.textM(context),
                      fontSize: 14,
                    ),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 14,
                    ),
                  ),
                  onChanged: _onSearchChanged,
                  textInputAction: TextInputAction.search,
                ),
              ),
              if (_searchController.text.isNotEmpty)
                GestureDetector(
                  onTap: _clearSearch,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: AppColors.div(context),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.close_rounded,
                        size: 12,
                        color: AppColors.text2(context),
                      ),
                    ),
                  ),
                )
              else
                const SizedBox(width: 14),
            ]),
          ),
        ],
      ),
    );
  }

  // ─── Idle state ─────────────────────────────────────────────────────────────

  Widget _buildIdleState() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 32, 16, 32),
        child: Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(AppColors.primary).withOpacity(0.08),
                border: Border.all(
                  color: const Color(AppColors.primary).withOpacity(0.15),
                  width: 1,
                ),
              ),
              child: const Icon(
                Icons.search_rounded,
                size: 36,
                color: Color(AppColors.primary),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Search for Channels',
              style: TextStyle(
                color: AppColors.text1(context),
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Type to find live channels, news, sports,\nmovies and more.',
              style: TextStyle(
                color: AppColors.textM(context),
                fontSize: 13,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                for (final term in const [
                  'Sports',
                  'News',
                  'Movies',
                  'Entertainment',
                  'Hindi',
                  'Music',
                  'Kids',
                ])
                  _QuickSearchChip(
                    label: term,
                    onTap: () {
                      _searchController.text = term;
                      if (_debounce?.isActive ?? false) _debounce!.cancel();
                      context.read<SearchCubit>().search(term);
                      setState(() {});
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  Widget _buildSearchLoading() {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        14,
        8,
        14,
        AppConstants.bottomNavClearance,
      ),
      itemCount: 8,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: _SkeletonSearchTile(),
      ),
    );
  }

  // ─── No results ─────────────────────────────────────────────────────────────

  Widget _buildNoResults(String query) {
    return EmptyStateWidget(
      icon: Icons.search_off_rounded,
      title: 'No Results for "$query"',
      subtitle: 'Try a different search term or check the spelling.',
      actionLabel: 'Clear Search',
      onAction: _clearSearch,
      iconColor: AppColors.textM(context),
    );
  }

  // ─── Results ────────────────────────────────────────────────────────────────

  Widget _buildResults(List<ChannelModel> channels) {
    final licenseState = context.watch<LicenseCubit>().state;
    final bool hasPro =
        licenseState is LicenseActive && licenseState.license.hasProAccess;
    final bool hasPlus =
        licenseState is LicenseActive && licenseState.license.hasPlusAccess;

    bool isChannelLocked(ChannelModel c) {
      final tier = c.normalizedTier;
      if (tier == 'free') return false;
      if (tier == 'plus') return !hasPlus;
      return !hasPro;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 6),
          child: Text(
            '${channels.length} result${channels.length == 1 ? '' : 's'}',
            style: TextStyle(
              color: AppColors.textM(context),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              14,
              4,
              14,
              AppConstants.bottomNavClearance,
            ),
            physics: const BouncingScrollPhysics(),
            itemCount: channels.length,
            itemBuilder: (context, index) {
              return PremiumChannelCard(
                channel: channels[index],
                variant: PremiumChannelCardVariant.list,
                showFavorite: true,
                isLocked: isChannelLocked(channels[index]),
                onTap: () => _openPlayer(channels[index], channels, index),
              );
            },
          ),
        ),
      ],
    );
  }

  void _openPlayer(ChannelModel channel, List<ChannelModel> results, int index) {
    context.read<MiniPlayerCubit>().play(
      channel,
      contextChannels: results,
      initialIndex: index,
      sourceType: PlayerSourceType.search,
      sourceFilters: ChannelSourceFilters(
        searchQuery: _searchController.text,
      ),
    );
  }
}

// ─── Quick Search Chip ────────────────────────────────────────────────────────

class _QuickSearchChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _QuickSearchChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfElevated(context),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppColors.div(context),
            width: 1,
          ),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(
            Icons.trending_up_rounded,
            size: 13,
            color: AppColors.textM(context),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: AppColors.text1(context),
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Skeleton Search Tile ─────────────────────────────────────────────────────

class _SkeletonSearchTile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surf(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.div(context),
          width: 0.5,
        ),
      ),
      child: Row(children: [
        const LoadingSkeleton(width: 50, height: 50, borderRadius: 11),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const LoadingSkeleton(width: 140, height: 13, borderRadius: 6),
              const SizedBox(height: 7),
              const LoadingSkeleton(width: 90, height: 10, borderRadius: 6),
            ],
          ),
        ),
        const LoadingSkeleton(width: 36, height: 18, borderRadius: 4),
      ]),
    );
  }
}
