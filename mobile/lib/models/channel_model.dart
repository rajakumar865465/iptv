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
  });

  factory ChannelModel.fromJson(Map<String, dynamic> json) {
    return ChannelModel(
      id: json['id'],
      name: json['name'],
      logoUrl: json['logo_url'],
      streamUrl: json['stream_url'] ?? '',
      backupStreamUrl: json['backup_stream_url'],
      categoryId: json['category_id'],
      categoryName: json['category_name'],
      language: json['language'],
      quality: json['quality'],
      status: json['status'] ?? 'active',
      isFeatured: json['is_featured'] ?? false,
      isPremium: json['is_premium'] ?? false,
      sortOrder: json['sort_order'] ?? 0,
      referrer: json['referrer'],
      userAgent: json['user_agent'],
      country: json['country'],
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
