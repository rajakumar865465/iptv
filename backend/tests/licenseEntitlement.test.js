const {
  TIER_RANK,
  normalizePlanTier,
  getEffectiveChannelTier,
  canPlanAccessChannel,
  isLicenseStatusUsable,
  calculateSubscriptionDates,
  isSubscriptionActive,
  remainingDays,
  resolveUserLicense,
} = require('../src/services/subscriptionService');

describe('Subscription Tier & Channel Access Matrix', () => {
  it('normalizes plan tiers safely', () => {
    expect(normalizePlanTier('free')).toBe('free');
    expect(normalizePlanTier('Starter')).toBe('starter');
    expect(normalizePlanTier('PRO')).toBe('pro');
    expect(normalizePlanTier(' plus ')).toBe('plus');
    expect(normalizePlanTier('')).toBe('free');
    expect(normalizePlanTier('unknown')).toBe('free');
    expect(normalizePlanTier(null)).toBe('free');
  });

  it('derives effective channel tier from channel_tier, is_premium, and is_paid', () => {
    expect(getEffectiveChannelTier({ channel_tier: 'plus', is_premium: true })).toBe('plus');
    expect(getEffectiveChannelTier({ channel_tier: 'pro', is_premium: false })).toBe('pro');
    expect(getEffectiveChannelTier({ channel_tier: 'free', is_premium: true })).toBe('pro');
    expect(getEffectiveChannelTier({ channel_tier: null, is_paid: true })).toBe('pro');
    expect(getEffectiveChannelTier({ channel_tier: 'free', is_premium: false, is_paid: false })).toBe('free');
    expect(getEffectiveChannelTier(null)).toBe('free');
  });

  it('enforces tier hierarchy free < starter < pro < plus across channels', () => {
    const freeCh = { channel_tier: 'free', is_premium: false };
    const proCh = { channel_tier: 'pro', is_premium: true };
    const plusCh = { channel_tier: 'plus', is_premium: true };
    const legacyPaidCh = { channel_tier: 'free', is_paid: true };

    expect(TIER_RANK).toEqual({ free: 0, starter: 1, pro: 2, plus: 3 });

    // Free and Starter only access free channels
    expect(canPlanAccessChannel('free', freeCh)).toBe(true);
    expect(canPlanAccessChannel('free', proCh)).toBe(false);
    expect(canPlanAccessChannel('free', plusCh)).toBe(false);

    expect(canPlanAccessChannel('starter', freeCh)).toBe(true);
    expect(canPlanAccessChannel('starter', proCh)).toBe(false);
    expect(canPlanAccessChannel('starter', plusCh)).toBe(false);
    expect(canPlanAccessChannel('starter', legacyPaidCh)).toBe(false);

    // Pro accesses free + pro + legacy paid, NOT plus
    expect(canPlanAccessChannel('pro', freeCh)).toBe(true);
    expect(canPlanAccessChannel('pro', proCh)).toBe(true);
    expect(canPlanAccessChannel('pro', legacyPaidCh)).toBe(true);
    expect(canPlanAccessChannel('pro', plusCh)).toBe(false);

    // Plus accesses all tiers
    expect(canPlanAccessChannel('plus', freeCh)).toBe(true);
    expect(canPlanAccessChannel('plus', proCh)).toBe(true);
    expect(canPlanAccessChannel('plus', legacyPaidCh)).toBe(true);
    expect(canPlanAccessChannel('plus', plusCh)).toBe(true);
  });
});

describe('License Lifecycle & Expiration', () => {
  const now = new Date('2026-11-12T12:00:00Z');
  const future = new Date('2026-11-20T12:00:00Z');
  const past = new Date('2026-11-10T12:00:00Z');

  it('evaluates usable statuses and live expires_at checks', () => {
    expect(isLicenseStatusUsable('active')).toBe(true);
    expect(isLicenseStatusUsable('trial')).toBe(true);
    expect(isLicenseStatusUsable('expired')).toBe(false);
    expect(isLicenseStatusUsable('revoked')).toBe(false);
    expect(isLicenseStatusUsable('suspended')).toBe(false);
    expect(isLicenseStatusUsable('blocked')).toBe(false);
    expect(isLicenseStatusUsable('pending_payment')).toBe(false);

    expect(isSubscriptionActive({ status: 'active', expires_at: future }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'trial', expires_at: future }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'active', expires_at: past }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'active', expires_at: now }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'revoked', expires_at: future }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'suspended', expires_at: future }, now)).toBe(false);
    expect(remainingDays(future, now)).toBe(8);
    expect(remainingDays(past, now)).toBe(0);
  });

  it('stacks renewal onto remaining live subscription days', () => {
    const res = calculateSubscriptionDates(30, future, true, now);
    expect(res.stacked).toBe(true);
    expect(res.startDate.getTime()).toBe(future.getTime());
    expect(res.expiresAt.getTime()).toBe(future.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it('lazily normalizes past-due active/trial licenses to expired in DB and returns expired status', async () => {
    const queries = [];
    const mockDb = {
      query: jest.fn(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.startsWith('SELECT l.*')) {
          return {
            rows: [
              {
                id: 42,
                license_key: 'NVT-AAAA-BBBB-CCCC',
                status: 'active',
                expires_at: past.toISOString(),
                plan_id: 2,
                plan_name: 'NivaTV Pro',
                plan_tier: 'pro',
                duration_days: 30,
                max_devices: 2,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const resolved = await resolveUserLicense(mockDb, {
      userId: 7,
      email: 'user@example.com',
      now,
      autoLink: false,
    });

    expect(resolved.licenseStatus).toBe('expired');
    expect(resolved.effectivePlanTier).toBe('free');
    expect(resolved.activeLicenses).toHaveLength(0);
    expect(resolved.effectiveLicense.status).toBe('expired');
    expect(resolved.remainingDays).toBe(0);

    const expireUpdate = queries.find((q) => q.sql.includes("SET status = 'expired'"));
    expect(expireUpdate).toBeDefined();
    expect(expireUpdate.params[0]).toEqual([42]);
  });

  it('selects highest active tier when user has multiple active licenses', async () => {
    const mockDb = {
      query: jest.fn(async (sql) => {
        if (sql.startsWith('SELECT l.*')) {
          return {
            rows: [
              {
                id: 10,
                license_key: 'NVT-STAR-TER1-0001',
                status: 'active',
                expires_at: new Date('2026-12-30T12:00:00Z').toISOString(),
                plan_name: 'Starter',
                plan_tier: 'starter',
                max_devices: 1,
              },
              {
                id: 11,
                license_key: 'NVT-PLUS-0002-0002',
                status: 'trial',
                expires_at: future.toISOString(),
                plan_name: 'NivaTV Plus',
                plan_tier: 'plus',
                max_devices: 4,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const resolved = await resolveUserLicense(mockDb, { userId: 7, now, autoLink: false });
    expect(resolved.licenseStatus).toBe('trial');
    expect(resolved.effectivePlanTier).toBe('plus');
    expect(resolved.effectiveLicense.id).toBe(11);
    expect(resolved.maxDevices).toBe(4);
  });
});
