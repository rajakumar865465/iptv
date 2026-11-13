import 'package:flutter_test/flutter_test.dart';
import 'package:iptv_app/models/channel_model.dart';
import 'package:iptv_app/models/license_model.dart';

void main() {
  group('LicenseModel lifecycle & tier access', () {
    test('free / no license defaults to free tier and inactive', () {
      final lic = LicenseModel(
        id: 0,
        licenseKey: '',
        status: 'none',
        planTier: 'free',
        maxDevices: 1,
      );
      expect(lic.isEffectiveActive, isFalse);
      expect(lic.hasProAccess, isFalse);
      expect(lic.hasPlusAccess, isFalse);
      expect(lic.canAccessChannelTier('free'), isTrue);
      expect(lic.canAccessChannelTier('pro'), isFalse);
      expect(lic.canAccessChannelTier('plus'), isFalse);
    });

    test('starter plan is active for free channels only', () {
      final lic = LicenseModel.fromJson({
        'status': 'active',
        'plan_tier': 'starter',
        'expires_at': DateTime.now().add(const Duration(days: 15)).toIso8601String(),
        'max_devices': 1,
      });
      expect(lic.isEffectiveActive, isTrue);
      expect(lic.normalizedTier, 'starter');
      expect(lic.hasProAccess, isFalse);
      expect(lic.hasPlusAccess, isFalse);
      expect(lic.isPremium, isFalse);
      expect(lic.canAccessChannelTier('free'), isTrue);
      expect(lic.canAccessChannelTier('pro'), isFalse);
      expect(lic.canAccessChannelTier('plus'), isFalse);
    });

    test('pro trial unlocks free + pro channels but not plus', () {
      final lic = LicenseModel.fromJson({
        'status': 'trial',
        'plan_tier': 'pro',
        'expires_at': DateTime.now().add(const Duration(days: 29)).toIso8601String(),
        'max_devices': 1,
        'used_devices': 1,
      });
      expect(lic.isTrial, isTrue);
      expect(lic.isEffectiveActive, isTrue);
      expect(lic.hasProAccess, isTrue);
      expect(lic.hasPlusAccess, isFalse);
      expect(lic.canAccessChannelTier('free'), isTrue);
      expect(lic.canAccessChannelTier('pro'), isTrue);
      expect(lic.canAccessChannelTier('plus'), isFalse);
    });

    test('plus plan unlocks free, pro, and plus channels', () {
      final lic = LicenseModel.fromJson({
        'status': 'active',
        'plan_tier': 'plus',
        'expires_at': DateTime.now().add(const Duration(days: 30)).toIso8601String(),
        'max_devices': 4,
        'used_devices': 1,
      });
      expect(lic.isEffectiveActive, isTrue);
      expect(lic.hasProAccess, isTrue);
      expect(lic.hasPlusAccess, isTrue);
      expect(lic.canAccessChannelTier('free'), isTrue);
      expect(lic.canAccessChannelTier('pro'), isTrue);
      expect(lic.canAccessChannelTier('plus'), isTrue);
    });

    test('past expiresAt forces isDateExpired and blocks paid tiers even if status is active', () {
      final lic = LicenseModel.fromJson({
        'status': 'active',
        'plan_tier': 'plus',
        'expires_at': DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(),
        'max_devices': 4,
        'used_devices': 1,
      });
      expect(lic.isDateExpired, isTrue);
      expect(lic.isEffectiveActive, isFalse);
      expect(lic.hasProAccess, isFalse);
      expect(lic.hasPlusAccess, isFalse);
      expect(lic.canAccessChannelTier('free'), isTrue);
      expect(lic.canAccessChannelTier('pro'), isFalse);
      expect(lic.canAccessChannelTier('plus'), isFalse);
    });

    test('revoked, suspended, blocked, and pending_payment expose distinct flags and deny paid access', () {
      for (final status in ['revoked', 'suspended', 'blocked', 'pending_payment']) {
        final lic = LicenseModel.fromJson({
          'status': status,
          'plan_tier': 'plus',
          'expires_at': DateTime.now().add(const Duration(days: 10)).toIso8601String(),
        });
        expect(lic.isEffectiveActive, isFalse);
        expect(lic.hasProAccess, isFalse);
        expect(lic.hasPlusAccess, isFalse);
        expect(lic.isRevoked, status == 'revoked');
        expect(lic.isSuspended, status == 'suspended');
        expect(lic.isBlocked, status == 'blocked');
        expect(lic.isPendingPayment, status == 'pending_payment');
      }
    });
  });

  group('ChannelModel tier resolution', () {
    test('normalizes free, pro, plus, and legacy is_premium/is_paid flags', () {
      final freeCh = ChannelModel.fromJson({
        'id': 1,
        'name': 'DD National',
        'channel_tier': 'free',
        'is_premium': false,
        'is_paid': false,
      });
      expect(freeCh.normalizedTier, 'free');
      expect(freeCh.isPaidTier, isFalse);
      expect(freeCh.isProTier, isFalse);
      expect(freeCh.isPlusTier, isFalse);

      final legacyPaidCh = ChannelModel.fromJson({
        'id': 2,
        'name': 'Paid Pro',
        'channel_tier': 'free',
        'is_paid': true,
      });
      expect(legacyPaidCh.normalizedTier, 'pro');
      expect(legacyPaidCh.isPaidTier, isTrue);
      expect(legacyPaidCh.isProTier, isTrue);
      expect(legacyPaidCh.isPlusTier, isFalse);

      final plusCh = ChannelModel.fromJson({
        'id': 3,
        'name': 'Plus Sports',
        'channel_tier': 'plus',
        'is_premium': true,
      });
      expect(plusCh.normalizedTier, 'plus');
      expect(plusCh.isPaidTier, isTrue);
      expect(plusCh.isProTier, isFalse);
      expect(plusCh.isPlusTier, isTrue);
    });
  });
}
