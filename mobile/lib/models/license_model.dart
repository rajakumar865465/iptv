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
      id: (json['id'] as num?)?.toInt() ?? 0,
      licenseKey: json['license_key']?.toString() ?? '',
      status: json['status']?.toString() ?? 'none',
      planName: json['plan_name']?.toString(),
      planTier: json['plan_tier']?.toString() ?? 'free',
      durationDays: (json['duration_days'] as num?)?.toInt(),
      maxDevices: (json['max_devices'] as num?)?.toInt(),
      activatedAt: json['activated_at'] != null ? DateTime.tryParse(json['activated_at'].toString()) : null,
      expiresAt: json['expires_at'] != null ? DateTime.tryParse(json['expires_at'].toString()) : null,
      remainingDays: (json['remaining_days'] as num?)?.toInt(),
    );
  }

  String get normalizedStatus => status.trim().toLowerCase();

  String get normalizedTier {
    final t = planTier.trim().toLowerCase();
    if (t == 'plus' || t == 'pro' || t == 'starter' || t == 'free') return t;
    return 'free';
  }

  bool get isTrial => normalizedStatus == 'trial';
  bool get isRevoked => normalizedStatus == 'revoked';
  bool get isSuspended => normalizedStatus == 'suspended';
  bool get isBlocked => normalizedStatus == 'blocked';
  bool get isPendingPayment => normalizedStatus == 'pending_payment';

  bool get isDateExpired {
    if (expiresAt != null && !expiresAt!.isAfter(DateTime.now())) {
      return true;
    }
    if (remainingDays != null && remainingDays! <= 0) {
      return true;
    }
    return false;
  }

  bool get isEffectiveActive {
    if (normalizedStatus != 'active' && normalizedStatus != 'trial') {
      return false;
    }
    return !isDateExpired;
  }

  bool get isActive => isEffectiveActive;
  bool get isExpired => normalizedStatus == 'expired' || ((normalizedStatus == 'active' || normalizedStatus == 'trial') && isDateExpired);

  bool get hasProAccess =>
      isEffectiveActive && (normalizedTier == 'pro' || normalizedTier == 'plus');
  bool get hasPlusAccess => isEffectiveActive && normalizedTier == 'plus';
  bool get isPremium => hasProAccess;

  bool canAccessChannelTier(String channelTier) {
    final ch = channelTier.trim().toLowerCase();
    if (ch.isEmpty || ch == 'free') return true;
    if (!isEffectiveActive) return false;
    if (ch == 'pro') return hasProAccess;
    if (ch == 'plus') return hasPlusAccess;
    return false;
  }
}

class PlanModel {
  final int id;
  final String name;
  final String planTier;
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
    this.planTier = 'free',
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
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? '',
      planTier: (json['plan_tier']?.toString() ?? 'free').trim().toLowerCase(),
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      durationDays: (json['duration_days'] as num?)?.toInt() ?? 0,
      maxDevices: (json['max_devices'] as num?)?.toInt() ?? 1,
      description: json['description']?.toString(),
      isPopular: json['is_popular'] == true,
      isBestValue: json['is_best_value'] == true,
      regularPrice: (json['regular_price'] as num?)?.toDouble(),
      offerLabel: json['offer_label']?.toString(),
    );
  }
}
