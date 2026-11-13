const request = require('supertest');
const express = require('express');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

const db = require('../src/config/db');
const cache = require('../src/utils/cache');
const { generateToken } = require('../src/utils/jwt');
const authMiddleware = require('../src/middleware/auth');
const { optionalAuth } = require('../src/middleware/auth');
const channelController = require('../src/controllers/channelController');
const licenseController = require('../src/controllers/licenseController');

function makeToken(userId = 10) {
  return generateToken({ userId, type: 'access' });
}

describe('Entitlement Routes & Lifecycle HTTP Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.get('/api/licenses/status', authMiddleware, licenseController.status);
    app.get('/api/channels/:id/playback', optionalAuth, channelController.getChannelPlayback);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cache.flush();
  });

  it('returns 403 USER_BLOCKED when a blocked user calls protected or optionalAuth routes', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: 10, full_name: 'Blocked User', email: 'b@example.com', status: 'blocked', role: 'user' }],
        };
      }
      return { rows: [] };
    });

    const token = makeToken(10);
    const res1 = await request(app)
      .get('/api/licenses/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(403);
    expect(res1.body.error_code).toBe('USER_BLOCKED');

    const res2 = await request(app)
      .get('/api/channels/5/playback')
      .set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(403);
    expect(res2.body.error_code).toBe('USER_BLOCKED');
  });

  it('normalizes past-due active license to expired on GET /api/licenses/status', async () => {
    const pastIso = new Date(Date.now() - 86400000).toISOString();
    const updateCalls = [];

    db.query.mockImplementation(async (sql, params) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: 10, full_name: 'Active User', email: 'a@example.com', status: 'active', role: 'user' }],
        };
      }
      if (sql.startsWith('SELECT l.*')) {
        return {
          rows: [
            {
              id: 88,
              license_key: 'NVT-EXP1-0000-0001',
              status: 'active',
              expires_at: pastIso,
              plan_name: 'NivaTV Pro',
              plan_tier: 'pro',
              duration_days: 30,
              max_devices: 2,
            },
          ],
        };
      }
      if (sql.includes("SET status = 'expired'")) {
        updateCalls.push(params);
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/licenses/status')
      .set('Authorization', `Bearer ${makeToken(10)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('expired');
    expect(res.body.data.plan_tier).toBe('free');
    expect(res.body.data.remaining_days).toBe(0);
    expect(updateCalls).toEqual([[[88]]]);
  });

  it('enforces channel tier & active license matrix on GET /api/channels/:id/playback', async () => {
    const futureIso = new Date(Date.now() + 10 * 86400000).toISOString();
    let mockChannelTier = 'pro';
    let mockChannelPaid = false;
    let mockLicenseTier = 'starter';
    let mockLicenseStatus = 'active';
    let mockExpiresAt = futureIso;

    db.query.mockImplementation(async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return { rows: [] };
      }
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [{ id: 10, full_name: 'Test User', email: 't@example.com', status: 'active', role: 'user' }],
        };
      }
      if (sql.includes('FROM channels c')) {
        return {
          rows: [
            {
              id: 55,
              name: 'Premium Test Channel',
              status: 'active',
              is_hidden: false,
              is_removed: false,
              is_visible_app: true,
              channel_tier: mockChannelTier,
              is_premium: mockChannelTier !== 'free',
              is_paid: mockChannelPaid,
              stream_url: 'https://example.com/live/index.m3u8',
            },
          ],
        };
      }
      if (sql.startsWith('SELECT l.*')) {
        if (mockLicenseStatus === 'none') return { rows: [] };
        return {
          rows: [
            {
              id: 99,
              license_key: 'NVT-TEST-1111-2222',
              status: mockLicenseStatus,
              expires_at: mockExpiresAt,
              plan_name: 'Test Plan',
              plan_tier: mockLicenseTier,
              duration_days: 30,
              max_devices: 2,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const token = makeToken(10);

    // 1. Anonymous user on Pro channel -> 401 AUTH_REQUIRED
    const anonPro = await request(app).get('/api/channels/55/playback');
    expect(anonPro.status).toBe(401);
    expect(anonPro.body.error_code).toBe('AUTH_REQUIRED');

    // 2. Starter license on Pro channel -> 403 upgrade_required
    mockChannelTier = 'pro';
    mockLicenseTier = 'starter';
    const starterOnPro = await request(app)
      .get('/api/channels/55/playback')
      .set('Authorization', `Bearer ${token}`);
    expect(starterOnPro.status).toBe(403);
    expect(starterOnPro.body.error_code).toBe('upgrade_required');
    expect(starterOnPro.body.required_tier).toBe('pro');
    expect(starterOnPro.body.current_tier).toBe('starter');

    // 3. Pro Trial on Plus channel -> 403 upgrade_required
    mockChannelTier = 'plus';
    mockLicenseTier = 'pro';
    mockLicenseStatus = 'trial';
    const proOnPlus = await request(app)
      .get('/api/channels/55/playback')
      .set('Authorization', `Bearer ${token}`);
    expect(proOnPlus.status).toBe(403);
    expect(proOnPlus.body.error_code).toBe('upgrade_required');
    expect(proOnPlus.body.required_tier).toBe('plus');
    expect(proOnPlus.body.current_tier).toBe('pro');

    // 4. Expired Pro license on Pro channel -> 403 LICENSE_REQUIRED
    mockChannelTier = 'pro';
    mockLicenseTier = 'pro';
    mockLicenseStatus = 'active';
    mockExpiresAt = new Date(Date.now() - 1000).toISOString();
    const expiredOnPro = await request(app)
      .get('/api/channels/55/playback')
      .set('Authorization', `Bearer ${token}`);
    expect(expiredOnPro.status).toBe(403);
    expect(expiredOnPro.body.error_code).toBe('LICENSE_REQUIRED');
    expect(expiredOnPro.body.license_status).toBe('expired');

    // 5. Active Pro Trial on Pro channel -> 200 OK
    mockExpiresAt = futureIso;
    mockLicenseStatus = 'trial';
    const trialOnPro = await request(app)
      .get('/api/channels/55/playback')
      .set('Authorization', `Bearer ${token}`);
    expect(trialOnPro.status).toBe(200);
    expect(trialOnPro.body.data.channel_id).toBe(55);

    // 6. Active Plus license on Plus channel -> 200 OK
    cache.flush();
    mockChannelTier = 'plus';
    mockLicenseTier = 'plus';
    mockLicenseStatus = 'active';
    const plusOnPlus = await request(app)
      .get('/api/channels/55/playback')
      .set('Authorization', `Bearer ${token}`);
    expect(plusOnPlus.status).toBe(200);
    expect(plusOnPlus.body.data.channel_id).toBe(55);
  });
});
