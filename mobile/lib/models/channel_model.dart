class ChannelModel {
  final int id;
  final String name;
  final String? logoUrl;
  final String streamUrl;
  final String? backupStreamUrl;
  final int? categoryId;
  final String? categoryName;
  final String? language;
  final String? quality;
  final String status;
  final String? healthStatus; // online | unstable | offline | unknown | null
  final bool isFeatured;
  final bool isPremium;
  final bool isPopular;
  final int sortOrder;
  final int popularityScore;
  final int watchCount;
  final int favoriteCount;
  final bool showOnHome;
  final String? referrer;
  final String? userAgent;
  final String? country;
  final String? localLogoUrl;
  final String? logoStatus;
  final int? healthScore;
  final String defaultFitMode;
  final String aspectRatioType;
  final bool hasInternalBlackBars;
  final int? channelNumber;
  final String? genre;
  final DateTime? createdAt;

  ChannelModel({
    required this.id,
    required this.name,
    this.logoUrl,
    required this.streamUrl,
    this.backupStreamUrl,
    this.categoryId,
    this.categoryName,
    this.language,
    this.quality,
    required this.status,
    this.healthStatus,
    this.isFeatured = false,
    this.isPremium = false,
    this.isPopular = false,
    this.sortOrder = 0,
    this.popularityScore = 0,
    this.watchCount = 0,
    this.favoriteCount = 0,
    this.showOnHome = true,
    this.referrer,
    this.userAgent,
    this.country,
    this.localLogoUrl,
    this.logoStatus,
    this.healthScore,
    this.defaultFitMode = 'original',
    this.aspectRatioType = 'unknown',
    this.hasInternalBlackBars = false,
    this.channelNumber,
    this.genre,
    this.createdAt,
  });

  /// True if this channel is likely playable (shown when workingOnly=true)
  bool get isPlayable {
    if (streamUrl.isEmpty) return false;
    final h = healthStatus?.toLowerCase();
    if (h == 'offline' || h == 'dead' || h == 'forbidden_403' ||
        h == 'drm_or_unsupported' || h == 'geo_blocked' ||
        h == 'requires_licensed_source') {
      return false;
    }
    return true;
  }

  /// Quality display label — normalised short form
  String get qualityLabel {
    final q = (quality ?? '').toLowerCase();
    if (q.contains('4k') || q.contains('uhd') || q.contains('2160')) return '4K';
    if (q.contains('fhd') || q.contains('1080')) return 'FHD';
    if (q.contains('hd') || q.contains('720')) return 'HD';
    if (q.contains('sd') || q.contains('480') || q.contains('576')) return 'SD';
    if (q.contains('360')) return '360p';
    if (q.isEmpty) return 'SD';
    return quality!.toUpperCase();
  }

  /// Permanent channel number as a zero-padded 3-digit label (e.g. "007").
  /// Returns null when the channel has no assigned number.
  String? get numberLabel => channelNumber?.toString().padLeft(3, '0');

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    String? parseString(dynamic value) {
      if (value == null) return null;
      final str = value.toString().trim();
      if (str.toLowerCase() == 'unknown') return null;
      return str.isEmpty ? null : str;
    }

    int parseInt(dynamic value, [int fallback = 0]) {
      if (value == null) return fallback;
      if (value is int) return value;
      if (value is double) return value.toInt();
      return int.tryParse(value.toString()) ?? fallback;
    }

    bool parseBool(dynamic value, [bool fallback = false]) {
      if (value == null) return fallback;
      if (value is bool) return value;
      final s = value.toString().toLowerCase();
      return s == 'true' || s == '1';
    }

    return ChannelModel(
      id: json['id'],
      name: json['name'] ?? '',
      logoUrl: json['logo_url'],
      streamUrl: json['stream_url'] ?? '',
      backupStreamUrl: json['backup_stream_url'],
      categoryId: json['category_id'],
      categoryName: parseString(json['category_name']),
      language: parseString(json['language']),
      quality: parseString(json['quality']),
      status: json['status'] ?? 'active',
      healthStatus: parseString(json['health_status']),
      isFeatured: parseBool(json['is_featured']),
      isPremium: parseBool(json['is_premium']),
      isPopular: parseBool(json['is_popular']),
      sortOrder: parseInt(json['sort_order']),
      popularityScore: parseInt(json['popularity_score']),
      watchCount: parseInt(json['watch_count']),
      favoriteCount: parseInt(json['favorite_count']),
      showOnHome: parseBool(json['show_on_home'], true),
      referrer: json['referrer'],
      userAgent: json['user_agent'],
      country: parseString(json['country']),
      localLogoUrl: json['local_logo_url'],
      logoStatus: json['logo_status'],
      healthScore: json['health_score'],
      defaultFitMode: json['default_fit_mode'] ?? 'original',
      aspectRatioType: json['aspect_ratio_type'] ?? 'unknown',
      hasInternalBlackBars: parseBool(json['has_internal_black_bars']),
      channelNumber: json['channel_number'] == null ? null : parseInt(json['channel_number']),
      genre: parseString(json['genre']),
      createdAt: json['created_at'] == null ? null : DateTime.tryParse(json['created_at'].toString()),
    );
  }
}

class CategoryModel {
  final int id;
  final String name;
  final String? iconUrl;
  final String status;
  final int sortOrder;
  final int channelCount;

  CategoryModel({
    required this.id,
    required this.name,
    this.iconUrl,
    required this.status,
    this.sortOrder = 0,
    this.channelCount = 0,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id'],
      name: json['name'] ?? '',
      iconUrl: json['icon_url'],
      status: json['status'] ?? 'active',
      sortOrder: json['sort_order'] ?? 0,
      channelCount: json['channel_count'] ?? 0,
    );
  }
}

class LanguageModel {
  final String name;
  final int channelCount;

  const LanguageModel({required this.name, required this.channelCount});

  factory LanguageModel.fromJson(Map<String, dynamic> json) {
    return LanguageModel(
      name: json['name'] ?? '',
      channelCount: json['channel_count'] ?? 0,
    );
  }
}

/// A category section for the Home screen, as returned by /api/home
class HomeCategorySection {
  final int id;
  final String name;
  final String? iconUrl;
  final int sortOrder;
  final int channelCount;
  final List<ChannelModel> channels;

  const HomeCategorySection({
    required this.id,
    required this.name,
    this.iconUrl,
    this.sortOrder = 0,
    this.channelCount = 0,
    required this.channels,
  });

  factory HomeCategorySection.fromJson(Map<String, dynamic> json) {
    final rawChannels = (json['channels'] as List? ?? []);
    return HomeCategorySection(
      id: json['id'],
      name: json['name'] ?? '',
      iconUrl: json['icon_url'],
      sortOrder: json['sort_order'] ?? 0,
      channelCount: json['channel_count'] ?? rawChannels.length,
      channels: rawChannels.map((c) => ChannelModel.fromJson(c)).toList(),
    );
  }
}

class EpgProgram {
  final int? id;
  final int? channelId;
  final String title;
  final String description;
  final DateTime? startTime;
  final DateTime? endTime;
  final double progress;

  EpgProgram({
    this.id,
    this.channelId,
    required this.title,
    required this.description,
    this.startTime,
    this.endTime,
    this.progress = 0.0,
  });

  factory EpgProgram.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      return DateTime.tryParse(val.toString());
    }

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    return EpgProgram(
      id: json['id'],
      channelId: json['channel_id'],
      title: json['title'] ?? 'Live Broadcast',
      description: json['description'] ?? 'Schedule information is not available.',
      startTime: parseDate(json['start_time']),
      endTime: parseDate(json['end_time']),
      progress: parseDouble(json['progress']),
    );
  }
}
