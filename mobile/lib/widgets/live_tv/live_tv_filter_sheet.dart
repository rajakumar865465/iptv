import 'package:flutter/material.dart';
import '../../constants.dart';
import '../../models/channel_model.dart';

/// Result of the Live TV filter sheet. Any field left null means "no filter"
/// for that facet (premiumFilter uses 'all' for the same meaning).
class LiveTvFilters {
  final String? genre;
  final String? language;
  final String? country;
  final String? quality;    // null | 'hd' | 'sd' | '4k'
  final String premiumFilter; // 'all' | 'true' | 'false'

  const LiveTvFilters({
    this.genre,
    this.language,
    this.country,
    this.quality,
    this.premiumFilter = 'all',
  });
}

/// Bottom sheet for narrowing the Live TV directory by Genre, Language,
/// Country, Quality and Access. Modeled on the sort sheet in live_tv_app_bar.dart.
class LiveTvFilterSheet extends StatefulWidget {
  final LiveTvFilters initial;
  final List<LanguageModel> languages;
  final List<String> countries;
  final ValueChanged<LiveTvFilters> onApply;

  const LiveTvFilterSheet({
    super.key,
    required this.initial,
    required this.languages,
    required this.countries,
    required this.onApply,
  });

  /// The 9 permanent genre super-blocks (matches backend channelNumbering.js).
  static const List<String> genres = [
    'News', 'Entertainment', 'Movies', 'Sports', 'Music',
    'Kids', 'Regional', 'Devotional', 'International', 'Other',
  ];

  @override
  State<LiveTvFilterSheet> createState() => _LiveTvFilterSheetState();
}

class _LiveTvFilterSheetState extends State<LiveTvFilterSheet> {
  String? _genre;
  String? _language;
  String? _country;
  String? _quality;
  String _premium = 'all';

  @override
  void initState() {
    super.initState();
    _genre = widget.initial.genre;
    _language = widget.initial.language;
    _country = widget.initial.country;
    _quality = widget.initial.quality;
    _premium = widget.initial.premiumFilter;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.82,
      ),
      decoration: const BoxDecoration(
        color: Color(AppColors.surfaceElevated),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(AppColors.divider),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text(
                  'Filter Channels',
                  style: TextStyle(
                    color: Color(AppColors.textPrimary),
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _genre = null;
                      _language = null;
                      _country = null;
                      _quality = null;
                      _premium = 'all';
                    });
                  },
                  child: const Text(
                    'Reset',
                    style: TextStyle(
                      color: Color(AppColors.brandRed),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _section(
                    'Genre',
                    [
                      _chip('All', _genre == null, () => setState(() => _genre = null)),
                      ...LiveTvFilterSheet.genres.map((g) =>
                          _chip(g, _genre == g, () => setState(() => _genre = g))),
                    ],
                  ),
                  _section(
                    'Access',
                    [
                      _chip('All', _premium == 'all', () => setState(() => _premium = 'all')),
                      _chip('Free', _premium == 'false', () => setState(() => _premium = 'false')),
                      _chip('Premium', _premium == 'true', () => setState(() => _premium = 'true')),
                    ],
                  ),
                  _section(
                    'Quality',
                    [
                      _chip('All', _quality == null, () => setState(() => _quality = null)),
                      _chip('HD', _quality == 'hd', () => setState(() => _quality = 'hd')),
                      _chip('SD', _quality == 'sd', () => setState(() => _quality = 'sd')),
                      _chip('4K', _quality == '4k', () => setState(() => _quality = '4k')),
                    ],
                  ),
                  if (widget.languages.isNotEmpty)
                    _section(
                      'Language',
                      [
                        _chip('All', _language == null, () => setState(() => _language = null)),
                        ...widget.languages.map((l) => _chip(
                              l.name,
                              _language?.toLowerCase() == l.name.toLowerCase(),
                              () => setState(() => _language = l.name),
                            )),
                      ],
                    ),
                  if (widget.countries.isNotEmpty)
                    _section(
                      'Country',
                      [
                        _chip('All', _country == null, () => setState(() => _country = null)),
                        ...widget.countries.map((c) => _chip(
                              c.toUpperCase(),
                              _country?.toLowerCase() == c.toLowerCase(),
                              () => setState(() => _country = c),
                            )),
                      ],
                    ),
                ],
              ),
            ),
          ),
          // Apply bar
          Padding(
            padding: EdgeInsets.fromLTRB(
              20, 12, 20, MediaQuery.of(context).padding.bottom + 14,
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  widget.onApply(LiveTvFilters(
                    genre: _genre,
                    language: _language,
                    country: _country,
                    quality: _quality,
                    premiumFilter: _premium,
                  ));
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppColors.primary),
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                child: const Text('Apply Filters'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> chips) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 10),
          child: Text(
            title,
            style: const TextStyle(
              color: Color(AppColors.textSecondary),
              fontSize: 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: chips,
        ),
        const SizedBox(height: 6),
      ],
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected
              ? const Color(AppColors.primary)
              : const Color(AppColors.surfaceLight),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? const Color(AppColors.primary)
                : const Color(AppColors.divider),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? Colors.white : const Color(AppColors.textSecondary),
          ),
        ),
      ),
    );
  }
}
