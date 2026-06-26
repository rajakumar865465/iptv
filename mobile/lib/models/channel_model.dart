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
  final String? healthStatus;   // online | unstable | offline | unknown | null
  final bool isFeatured;
  final bool isPremium;
  final int sortOrder;
  final String? referrer;
  final String? userAgent;
  final String? country;
  final String? localLogoUrl;
  final String? logoStatus;
  final int? healthScore;

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
    this.sortOrder = 0,
    this.referrer,
    this.userAgent,
    this.country,
    this.localLogoUrl,
    this.logoStatus,
    this.healthScore,
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

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    String? parseString(dynamic value) {
      if (value == null) return null;
      final str = value.toString().trim();
      if (str.toLowerCase() == 'unknown') return null;
      return str.isEmpty ? null : str;
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
      isFeatured: json['is_featured'] ?? false,
      isPremium: json['is_premium'] ?? false,
      sortOrder: json['sort_order'] ?? 0,
      referrer: json['referrer'],
      userAgent: json['user_agent'],
      country: parseString(json['country']),
      localLogoUrl: json['local_logo_url'],
      logoStatus: json['logo_status'],
      healthScore: json['health_score'],
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
