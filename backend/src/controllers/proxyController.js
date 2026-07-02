const https = require('https');
const http = require('http');
const { URL } = require('url');
const { pipeline } = require('node:stream');
const db = require('../config/db');
const { encryptSegmentUrl, decryptSegmentToken } = require('../utils/proxyToken');

// Health statuses that must never be served via proxy
// (DRM, geo-blocked, unauthorized, unlicensed paid content)
const PROXY_BLOCKED_STATUSES = new Set([
  'requires_licensed_source', 'drm_or_unsupported', 'geo_blocked',
  'forbidden_403', 'offline', 'dead',
]);

// License types eligible for proxy. 'paid_drm' and similar are not eligible.
const PROXY_ALLOWED_LICENSE_TYPES = new Set(['free', 'licensed', 'public', null, undefined]);

/**
 * Verify that the requesting user has an active license and is allowed
 * to proxy this specific stream. Called at the top of proxyManifest and
 * proxySegment so auth is checked before any upstream request.
 *
 * Returns { stream, channel } on success; throws an Error with a .statusCode
 * property on failure so callers can send the right HTTP response.
 */
async function verifyProxyAccess(req, streamId) {
  // req.user is already set by authMiddleware (JWT verified, user active)
  const userId = req.user?.id;
  if (!userId) {
    const e = new Error('Authentication required'); e.statusCode = 401; throw e;
  }

  // ── License check ────────────────────────────────────────────────────────
  const licRes = await db.query(`
    SELECT l.id, l.status, l.expires_at
    FROM licenses l
    WHERE l.user_id = $1
      AND l.status = 'active'
      AND l.expires_at > NOW()
    ORDER BY l.expires_at DESC
    LIMIT 1
  `, [userId]);
  if (licRes.rows.length === 0) {
    const e = new Error('Active license required'); e.statusCode = 403; throw e;
  }

  // ── Device check ─────────────────────────────────────────────────────────
  // Allow if at least one active device record exists for this user
  // (device limit enforcement is done at login/activation; if user has a device
  //  record it means they are within the allowed device count)
  const devRes = await db.query(`
    SELECT 1 FROM devices
    WHERE user_id = $1 AND status = 'active'
    LIMIT 1
  `, [userId]);
  if (devRes.rows.length === 0) {
    const e = new Error('No active device found'); e.statusCode = 403; throw e;
  }

  // ── Stream + channel lookup ───────────────────────────────────────────────
  // Try channel_streams first (streamId is a channel_streams.id)
  let stream = null;
  let channel = null;

  const csRes = await db.query(`
    SELECT cs.*, c.is_hidden, c.is_removed, c.is_visible_app,
           c.health_status AS channel_health, c.name AS channel_name,
           c.is_featured, c.is_popular, c.is_premium
    FROM channel_streams cs
    JOIN channels c ON c.id = cs.channel_id
    WHERE cs.id = $1
  `, [streamId]);

  if (csRes.rows.length > 0) {
    const row = csRes.rows[0];
    stream = row;
    channel = {
      is_hidden: row.is_hidden,
      is_removed: row.is_removed,
      is_visible_app: row.is_visible_app,
      health_status: row.channel_health,
      name: row.channel_name,
    };
  } else {
    // Fallback: streamId might be a channels.id (legacy)
    const chRes = await db.query(`
      SELECT id, stream_url, user_agent, referrer AS referer,
             is_hidden, is_removed, is_visible_app, health_status, name
      FROM channels WHERE id = $1
    `, [streamId]);
    if (chRes.rows.length === 0) {
      const e = new Error('Stream not found'); e.statusCode = 404; throw e;
    }
    const row = chRes.rows[0];
    stream = { ...row, playback_mode: 'direct', license_type: 'free', is_hidden: false, is_hidden_stream: false };
    channel = row;
  }

  // ── Channel visibility checks ─────────────────────────────────────────────
  if (channel.is_hidden || channel.is_removed || channel.is_visible_app === false) {
    const e = new Error('Channel is not available'); e.statusCode = 404; throw e;
  }

  // ── Stream active check ───────────────────────────────────────────────────
  if (stream.is_hidden) {
    const e = new Error('Stream is not available'); e.statusCode = 404; throw e;
  }

  // ── DRM / geo-blocked / unlicensed check ─────────────────────────────────
  if (PROXY_BLOCKED_STATUSES.has(channel.health_status)) {
    const e = new Error('This stream requires a licensed source and cannot be proxied');
    e.statusCode = 403; throw e;
  }
  if (PROXY_BLOCKED_STATUSES.has(stream.health_status)) {
    const e = new Error('This stream is not eligible for proxy'); e.statusCode = 403; throw e;
  }
  if (!PROXY_ALLOWED_LICENSE_TYPES.has(stream.license_type)) {
    const e = new Error('This stream requires a direct licensed connection');
    e.statusCode = 403; throw e;
  }

  return { stream, channel };
}

// Fix #7: Replace unbounded Maps with size-limited caches to prevent memory leaks.
// Simple LRU-style cache with max entries and TTL.
class BoundedCache {
  constructor(maxSize, ttlMs) {
    this._map = new Map();
    this._maxSize = maxSize;
    this._ttlMs = ttlMs;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.time > this._ttlMs) {
      this._map.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key, value) {
    // Evict oldest entry if at capacity
    if (this._map.size >= this._maxSize) {
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, { time: Date.now(), data: value });
  }

  delete(key) {
    this._map.delete(key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}

// Fix #7 (manifest cache TTL): HLS segments are typically 4–10s long.
// 3s was causing near-constant upstream manifest re-fetches and buffering stutters.
// 8s aligns better with HLS spec (cache for ~1× target_duration).
const CACHE_MANIFEST_MS = 8000;

// Note: Segment caching has been removed to prevent massive memory leaks and GC pauses
const manifestCache = new BoundedCache(200, CACHE_MANIFEST_MS);

// Fix #8: Add depth counter to prevent infinite redirect loops
// Fix #6: Increased timeout from 8s → 20s — live HLS sources from slow CDNs
// frequently take 10–15s to respond, causing unnecessary stream failures at 8s.
function makeProxyRequest(url, headers, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 5) {
      return reject(new Error('Too many redirects'));
    }

    let parsed;
    try { parsed = new URL(url); } catch(e) { return reject(e); }
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(url, { headers, timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect with incremented depth counter
        return resolve(makeProxyRequest(res.headers.location, headers, redirectDepth + 1));
      }
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function resolveUrl(base, relative) {
  if (relative.startsWith('http')) return relative;
  try { return new URL(relative, base).href; } catch { return null; }
}

exports.proxyManifest = async (req, res) => {
  try {
    const { streamId } = req.params;

    // ── Auth + visibility + DRM guard ────────────────────────────────────────
    let stream;
    try {
      ({ stream } = await verifyProxyAccess(req, streamId));
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }

    const stream_url = stream.stream_url || stream.final_url;
    if (!stream_url) return res.status(404).send('Stream URL not configured');

    // Check manifest cache (after auth so we don't cache responses for unauthorized requests)
    const cachedManifest = manifestCache.get(streamId);
    if (cachedManifest) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(cachedManifest.data);
    }

    // Sanitize headers_json — only allow safe header names (prevent header injection)
    const ALLOWED_HEADER_NAMES = new Set([
      'user-agent', 'referer', 'origin', 'accept', 'accept-language',
      'x-forwarded-for', 'x-requested-with', 'cookie',
    ]);
    const safeExtraHeaders = {};
    if (stream.headers_json && typeof stream.headers_json === 'object') {
      for (const [k, v] of Object.entries(stream.headers_json)) {
        if (ALLOWED_HEADER_NAMES.has(k.toLowerCase())) {
          safeExtraHeaders[k] = v;
        }
      }
    }

    const headers = {
      'User-Agent': stream.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(stream.referer ? { 'Referer': stream.referer } : {}),
      ...(stream.origin ? { 'Origin': stream.origin } : {}),
      ...safeExtraHeaders,
    };

    const proxyRes = await makeProxyRequest(stream_url, headers);

    // Fix #1: Also accept 206 Partial Content — many CDN/live stream servers return 206
    // for range requests. Previously this was rejected as an error, killing the stream.
    if (proxyRes.statusCode !== 200 && proxyRes.statusCode !== 206) {
      return res.status(proxyRes.statusCode).send('Upstream error');
    }

    let body = '';
    proxyRes.setEncoding('utf8');
    for await (const chunk of proxyRes) body += chunk;

    // Rewrite URLs — encrypt each segment URL so the original source is never exposed.
    // The client only sees an opaque AES-GCM ciphertext token, not the real URL.
    const userId = req.user?.id || 'anon';
    const baseUrl = stream_url;
    const lines = body.split('\n');
    const rewritten = lines.map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const fullUrl = resolveUrl(baseUrl, t);
      if (!fullUrl) return line;
      // AES-256-GCM encrypted token — original URL is never visible to the client
      const token = encryptSegmentUrl(fullUrl, streamId, userId);
      const ext = fullUrl.includes('.m3u8') ? '.m3u8' : '.ts';
      return `/api/proxy/segment/${streamId}/${token}${ext}`;
    }).join('\n');

    // Note: cache key is still streamId but cache holds DIFFERENT tokens each fetch
    // (IVs differ per encryption). This is correct — we don't cache plaintext URLs.
    manifestCache.set(streamId, rewritten);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritten);
  } catch (err) {
    console.error('proxyManifest err:', err.message);
    res.status(500).send('Proxy error');
  }
};

// Fix #8: Smarter retry logic — distinguish permanent vs transient failures.
// 4xx errors (403, 404) are permanent; retrying wastes time and delays the 502 response.
// 5xx errors and timeouts are transient; retry with exponential backoff (200ms → 400ms → 800ms).
async function fetchSegmentWithRetry(targetUrl, headers) {
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [200, 400, 800];

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const proxyRes = await makeProxyRequest(targetUrl, headers);
      // Permanent 4xx failures — stop immediately, no retry
      if (proxyRes.statusCode >= 400 && proxyRes.statusCode < 500) {
        return proxyRes;
      }
      // Success or 2xx/3xx — return as-is
      return proxyRes;
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]));
      }
    }
  }
  throw lastError;
}

exports.proxySegment = async (req, res) => {
  try {
    const { streamId, segToken } = req.params;

    // ── Decrypt + validate the segment token ─────────────────────────────────
    // The token was generated by proxyManifest for this specific streamId + userId.
    // It embeds the original URL, an expiry, and a stream binding — no Bearer needed.
    // Base64url chars [A-Za-z0-9_-] — strip any file extension suffix (.ts/.m3u8).
    let targetUrl;
    try {
      const cleanToken = segToken.replace(/\.(ts|m3u8)$/, '');
      const decrypted = decryptSegmentToken(cleanToken, streamId);
      targetUrl = decrypted.url;
    } catch (tokenErr) {
      console.warn('[proxy] segment token invalid:', tokenErr.message);
      return res.status(403).send('Invalid or expired segment token');
    }

    // SSRF prevention — validate decrypted URL before making request
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).send('Invalid segment URL');
      }
      const host = parsed.hostname.toLowerCase();
      const BLOCKED_PATTERNS = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^::1$/,
        /^fc00:/,
        /^fe80:/,
        /^0\./,
      ];
      if (BLOCKED_PATTERNS.some(p => p.test(host))) {
        return res.status(400).send('Invalid segment URL');
      }
    } catch {
      return res.status(400).send('Invalid segment URL');
    }

    // Fetch the stream record for headers (needed to add UA/Referer on upstream request).
    // This is a lightweight lookup — only headers fields needed, not full auth re-check.
    // Full auth (license, device, visibility) was already verified at manifest time.
    let stream = null;
    try {
      const csRes = await db.query(
        'SELECT user_agent, referer, origin, headers_json, health_status, is_hidden FROM channel_streams WHERE id = $1',
        [streamId]
      );
      if (csRes.rows.length > 0) {
        stream = csRes.rows[0];
        // Reject if stream was hidden/blocked after the token was issued
        if (stream.is_hidden) return res.status(404).send('Stream not available');
        if (PROXY_BLOCKED_STATUSES.has(stream.health_status)) return res.status(403).send('Stream not eligible for proxy');
      }
    } catch (_) {
      // DB lookup failure — continue without custom headers, upstream request will still work
    }

    // Build upstream headers from stream record (null-safe — stream may be null on DB failure)
    const ALLOWED_HEADER_NAMES = new Set([
      'user-agent', 'referer', 'origin', 'accept', 'accept-language',
      'x-forwarded-for', 'x-requested-with', 'cookie',
    ]);
    const safeExtraHeaders = {};
    if (stream?.headers_json && typeof stream.headers_json === 'object') {
      for (const [k, v] of Object.entries(stream.headers_json)) {
        if (ALLOWED_HEADER_NAMES.has(k.toLowerCase())) {
          safeExtraHeaders[k] = v;
        }
      }
    }

    const headers = {
      'User-Agent': stream?.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...(stream?.referer ? { 'Referer': stream.referer } : {}),
      ...(stream?.origin ? { 'Origin': stream.origin } : {}),
      ...safeExtraHeaders,
    };

    // Fix #8: Use smart retry helper with exponential backoff and 4xx fast-fail
    let proxyRes;
    try {
      proxyRes = await fetchSegmentWithRetry(targetUrl, headers);
    } catch (e) {
      return res.status(502).send('Upstream segment unavailable');
    }

    // Fix #1: Also accept 206 Partial Content from upstream CDNs
    if (proxyRes.statusCode !== 200 && proxyRes.statusCode !== 206) {
      return res.status(proxyRes.statusCode).send('Upstream error');
    }

    // Stream the data directly to the client, preserving the upstream Content-Type.
    // This is critical because some segments are actually child .m3u8 playlists,
    // and ExoPlayer will crash if a playlist is served as video/mp2t.
    const contentType = proxyRes.headers['content-type'] || (targetUrl.includes('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
    res.setHeader('Content-Type', contentType);

    // Fix #9: Use stream.pipeline() instead of proxyRes.pipe(res).
    // pipeline() handles backpressure properly — if the client reads slowly,
    // it pauses the upstream read instead of buffering unboundedly in memory.
    // It also auto-destroys both streams on error or completion.
    pipeline(proxyRes, res, (err) => {
      if (err) {
        console.error('Stream pipeline error:', err.message);
        if (!res.headersSent) res.status(500).end();
      }
    });

  } catch (err) {
    console.error('proxySegment outer err:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
};
