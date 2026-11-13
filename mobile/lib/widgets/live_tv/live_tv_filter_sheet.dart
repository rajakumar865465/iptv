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
  final String? tierFilter;   // null | 'free' | 'pro' | 'plus'

  const LiveTvFilters({
    this.genre,
    this.language,
    this.country,
    this.quality,
    this.premiumFilter = 'all',
    this.tierFilter,
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
  String? _tier;

  @override
  void initState() {
    super.initState();
    _genre = widget.initial.genre;
    _language = widget.initial.language;
    _country = widget.initial.country;
    _quality = widget.initial.quality;
    _premium = widget.initial.premiumFilter;
    _tier = widget.initial.tierFilter;
  }

  @override
  Widget build(BuildContext context) {
    final surfColor = AppColors.surfElevated(context);
    final text1 = AppColors.text1(context);
    final divColor = AppColors.div(context);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: surfColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
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
                color: divColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Text(
                  'Filter Channels',
                  style: TextStyle(
                    color: text1,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
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
                      _tier = null;
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(AppColors.brandRed).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      'Reset All',
                      style: TextStyle(
                        color: Color(AppColors.brandRed),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
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
                      _chip(context, 'All', _genre == null, () => setState(() => _genre = null)),
                      ...LiveTvFilterSheet.genres.map((g) =>
                          _chip(context, g, _genre == g, () => setState(() => _genre = g))),
                    ],
                  ),
                  _section(
                    'Access Tier',
                    [
                      _chip(
                        context,
                        'All',
                        _tier == null && _premium == 'all',
                        () => setState(() {
                          _tier = null;
                          _premium = 'all';
                        }),
                      ),
                      _chip(
                        context,
                        'Free',
                        _tier == 'free' || _premium == 'false',
                        () => setState(() {
                          _tier = 'free';
                          _premium = 'all';
                        }),
                      ),
                      _chip(
                        context,
                        'Pro',
                        _tier == 'pro',
                        () => setState(() {
                          _tier = 'pro';
                          _premium = 'all';
                        }),
                      ),
                      _chip(
                        context,
                        'Plus',
                        _tier == 'plus',
                        () => setState(() {
                          _tier = 'plus';
                          _premium = 'all';
                        }),
                      ),
                      _chip(
                        context,
                        'All Paid (Pro + Plus)',
                        _tier == null && _premium == 'true',
                        () => setState(() {
                          _tier = null;
                          _premium = 'true';
                        }),
                      ),
                    ],
                  ),
                  _section(
                    'Video Quality',
                    [
                      _chip(context, 'All Qualities', _quality == null, () => setState(() => _quality = null)),
                      _chip(context, '4K Ultra HD', _quality == '4k', () => setState(() => _quality = '4k')),
                      _chip(context, 'Full HD (1080p)', _quality == 'hd', () => setState(() => _quality = 'hd')),
                      _chip(context, 'Standard (SD)', _quality == 'sd', () => setState(() => _quality = 'sd')),
                    ],
                  ),
                  if (widget.languages.isNotEmpty)
                    _section(
                      'Broadcast Language',
                      [
                        _chip(context, 'All Languages', _language == null, () => setState(() => _language = null)),
                        ...widget.languages.map((l) => _chip(
                              context,
                              l.name,
                              _language?.toLowerCase() == l.name.toLowerCase(),
                              () => setState(() => _language = l.name),
                            )),
                      ],
                    ),
                  if (widget.countries.isNotEmpty)
                    _section(
                      'Region / Country',
                      [
                        _chip(context, 'All Countries', _country == null, () => setState(() => _country = null)),
                        ...widget.countries.map((c) => _chip(
                              context,
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
              height: 52,
              child: ElevatedButton(
                onPressed: () {
                  widget.onApply(LiveTvFilters(
                    genre: _genre,
                    language: _language,
                    country: _country,
                    quality: _quality,
                    premiumFilter: _premium,
                    tierFilter: _tier,
                  ));
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppColors.primary),
                  foregroundColor: Colors.white,
                  elevation: 4,
                  shadowColor: const Color(AppColors.primary).withOpacity(0.4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.filter_alt_rounded, size: 18),
                    SizedBox(width: 8),
                    Text('Apply Filter Preferences'),
                  ],
                ),
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
          padding: const EdgeInsets.only(top: 10, bottom: 10),
          child: Text(
            title,
            style: TextStyle(
              color: AppColors.text2(context),
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: chips,
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _chip(BuildContext context, String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? const Color(AppColors.primary)
              : AppColors.surfLight(context),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected
                ? const Color(AppColors.primary)
                : AppColors.div(context),
            width: selected ? 1.2 : 0.8,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: const Color(AppColors.primary).withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              const Icon(Icons.check_rounded, size: 14, color: Colors.white),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                color: selected
                    ? Colors.white
                    : AppColors.text1(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
