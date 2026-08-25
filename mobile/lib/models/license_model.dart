class LicenseModel {
  final int id;
  final String licenseKey;
  final String status;
  final String? planName;
  final String planTier;
  final int? durationDays;
  final int? maxDevices;
  final DateTime? activatedAt;
  final DateTime? expiresAt;
  final int? remainingDays;

  LicenseModel({
    required this.id,
    required this.licenseKey,
    required this.status,
    this.planName,
    this.planTier = 'free',
    this.durationDays,
    this.maxDevices,
    this.activatedAt,
    this.expiresAt,
    this.remainingDays,
  });

  factory LicenseModel.fromJson(Map<String, dynamic> json) {
    return LicenseModel(
      id: json['id'],
      licenseKey: json['license_key'],
      status: json['status'],
      planName: json['plan_name'],
      planTier: json['plan_tier'] ?? 'free',
      durationDays: json['duration_days'],
      maxDevices: json['max_devices'],
      activatedAt: json['activated_at'] != null ? DateTime.parse(json['activated_at']) : null,
      expiresAt: json['expires_at'] != null ? DateTime.parse(json['expires_at']) : null,
      remainingDays: json['remaining_days'],
    );
  }

  bool get isActive => status == 'active';
  bool get isExpired => status == 'expired';
  bool get isRevoked => status == 'revoked';
  bool get isPremium => durationDays != null && durationDays! > 1;
  bool get isSuspended => status == 'suspended';
  bool get hasProAccess => planTier == 'pro' || planTier == 'plus';
  bool get hasPlusAccess => planTier == 'plus';
}

class PlanModel {
  final int id;
  final String name;
  final double price;
  final int durationDays;
  final int maxDevices;
  final String? description;
  final bool isPopular;
  final bool isBestValue;
  final double? regularPrice;
  final String? offerLabel;

  PlanModel({
    required this.id,
    required this.name,
    required this.price,
    required this.durationDays,
    required this.maxDevices,
    this.description,
    this.isPopular = false,
    this.isBestValue = false,
    this.regularPrice,
    this.offerLabel,
  });

  factory PlanModel.fromJson(Map<String, dynamic> json) {
    return PlanModel(
      id: json['id'],
      name: json['name'] ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      durationDays: json['duration_days'] ?? 0,
      maxDevices: json['max_devices'] ?? 1,
      description: json['description'],
      isPopular: json['is_popular'] == true,
      isBestValue: json['is_best_value'] == true,
      regularPrice: (json['regular_price'] as num?)?.toDouble(),
      offerLabel: json['offer_label'],
    );
  }
}
