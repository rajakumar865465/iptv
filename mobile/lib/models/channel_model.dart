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
  final bool isFeatured;
  final bool isPremium;
  final int sortOrder;
  final String? referrer;
  final String? userAgent;
  final String? country;
  final String? localLogoUrl;
  final String? logoStatus;

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
    this.isFeatured = false,
    this.isPremium = false,
    this.sortOrder = 0,
    this.referrer,
    this.userAgent,
    this.country,
    this.localLogoUrl,
    this.logoStatus,
  });

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    String? parseString(dynamic value) {
      if (value == null) return null;
      final str = value.toString().trim();
      if (str.toLowerCase() == 'unknown') return null;
      return str;
    }

    return ChannelModel(
      id: json['id'],
      name: json['name'],
      logoUrl: json['logo_url'],
      streamUrl: json['stream_url'] ?? '',
      backupStreamUrl: json['backup_stream_url'],
      categoryId: json['category_id'],
      categoryName: parseString(json['category_name']),
      language: parseString(json['language']),
      quality: parseString(json['quality']),
      status: json['status'] ?? 'active',
      isFeatured: json['is_featured'] ?? false,
      isPremium: json['is_premium'] ?? false,
      sortOrder: json['sort_order'] ?? 0,
      referrer: json['referrer'],
      userAgent: json['user_agent'],
      country: parseString(json['country']),
      localLogoUrl: json['local_logo_url'],
      logoStatus: json['logo_status'],
    );
  }
}

class CategoryModel {
  final int id;
  final String name;
  final String? iconUrl;
  final String status;
  final int sortOrder;

  CategoryModel({
    required this.id,
    required this.name,
    this.iconUrl,
    required this.status,
    this.sortOrder = 0,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id'],
      name: json['name'],
      iconUrl: json['icon_url'],
      status: json['status'] ?? 'active',
      sortOrder: json['sort_order'] ?? 0,
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
