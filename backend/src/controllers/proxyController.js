const https = require('https');
const http = require('http');
const { URL } = require('url');
const { pipeline } = require('node:stream');
const dns = require('dns').promises;
const db = require('../config/db');
const { encryptSegmentUrl, decryptSegmentToken } = require('../utils/proxyToken');

// ── Persistent connection pools ────────────────────────────────────────────────
// Re-using TCP connections to upstream CDNs eliminates the 50-200ms TCP+TLS
// handshake overhead on every segment request (~1 req / 2-3s / viewer).
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,          // concurrent upstream connections per CDN host
  maxFreeSockets: 16,      // idle sockets kept alive in pool
  timeout: 25000,
  freeSocketTimeout: 30000,
});
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 25000,
  freeSocketTimeout: 30000,
});

// SSRF protection: resolve hostname to IP and reject private/link-local/loopback ranges.
// Called on every URL before making an outbound request, including after each redirect hop.
// Returns true if safe, false if the resolved IP is in a blocked range.
async function isSafeExternalUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname;

    // Reject numeric IPs that look like decimal-encoded private addresses
    // (e.g. 2130706433 = 127.0.0.1) by checking the raw hostname against IP patterns first
    const ipv4Literal = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (ipv4Literal) {
      // It's a literal IPv4 — validate it directly
      return !isPrivateIp(hostname);
    }

    // For hostnames, resolve to IP(s) and validate all of them
    let addresses;
    try {
      addresses = await dns.resolve4(hostname).catch(async () => {
        const r6 = await dns.resolve6(hostname).catch(() => []);
        return r6;
      });
    } catch {
      return false; // DNS failure — refuse
    }
    if (!addresses || addresses.length === 0) return false;

    // ALL resolved IPs must be safe (DNS rebinding: if any resolves private, reject)
    return addresses.every(ip => !isPrivateIp(ip));
  } catch {
    return false;
  }
}

function isPrivateIp(ip) {
  // Covers: loopback, link-local (169.254.x.x), private RFC-1918,
  // IPv6 loopback, unique-local, link-local, and the EC2 metadata endpoint.
  const BLOCKED = [
    /^127\./,
    /^0\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./, // EC2 metadata + link-local — this is the critical missing pattern
    /^::1$/,
    /^fc00:/i,
    /^fd[0-9a-f]{2}:/i, // RFC-4193 unique-local
    /^fe80:/i,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // RFC-6598 shared address space
    /^localhost$/i,
  ];
  return BLOCKED.some(p => p.test(ip));
}

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
  // req.user is already set by authMiddleware (if JWT provided and valid)
  const userId = req.user?.id;
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const cacheKey = `${ip}:${streamId}`;

  if (!userId) {
    if (ipAuthCache.get(cacheKey)) {
      console.warn(`[proxy] Anonymous proxy access allowed via IP cache (HLS reload) for streamId=${streamId}, IP=${ip}`);
      ipAuthCache.set(cacheKey, true); // Refresh TTL
    } else {
      const e = new Error('Active license required (No token provided)'); e.statusCode = 401; throw e;
    }
  } else {

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
  
  } // End of userId check bypass

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

  // ── Stream active check ───────────────────────────────────────────────────
  if (stream.is_hidden) {
    console.warn(`[proxy] proxy_block_reason: stream_hidden (streamId=${streamId})`);
    const e = new Error('Stream is not available'); e.statusCode = 404; throw e;
  }
  if (stream.is_active === false) {
    console.warn(`[proxy] proxy_block_reason: stream_inactive (streamId=${streamId})`);
    const e = new Error('Stream is not active'); e.statusCode = 404; throw e;
  }

  // ── DRM / geo-blocked / unlicensed check ─────────────────────────────────
  if (PROXY_BLOCKED_STATUSES.has(channel.health_status)) {
    console.warn(`[proxy] proxy_block_reason: blocked_channel_status (health=${channel.health_status}, streamId=${streamId})`);
    const e = new Error('This stream requires a licensed source and cannot be proxied');
    e.statusCode = 403; throw e;
  }
  if (PROXY_BLOCKED_STATUSES.has(stream.health_status)) {
    console.warn(`[proxy] proxy_block_reason: blocked_stream_status (health=${stream.health_status}, streamId=${streamId})`);
    const e = new Error('This stream is not eligible for proxy'); e.statusCode = 403; throw e;
  }
  if (!PROXY_ALLOWED_LICENSE_TYPES.has(stream.license_type)) {
    console.warn(`[proxy] proxy_block_reason: license_type_not_allowed (license=${stream.license_type}, streamId=${streamId})`);
    const e = new Error('This stream requires a direct licensed connection');
    e.statusCode = 403; throw e;
  }

  // Success! Record IP in cache so subsequent HLS reloads without headers succeed.
  if (userId) {
    ipAuthCache.set(cacheKey, true);
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

// Cache authorized IPs for 15 minutes to allow HLS live reloads where players drop headers
const ipAuthCache = new BoundedCache(10000, 1000 * 60 * 15);

// ── DNS safety result cache ─────────────────────────────────────────────────
// isSafeExternalUrl() does a DNS resolve on every call. For segment requests
// (one every 2-3s per viewer), this adds a round-trip to the DNS resolver before
// every upstream fetch. Cache the result per hostname for 5 minutes.
const dnsCache = new BoundedCache(500, 5 * 60 * 1000);

async function isSafeExternalUrlCached(urlString) {
  try {
    const hostname = new URL(urlString).hostname;
    const cached = dnsCache.get(hostname);
    if (cached !== undefined) return cached.data;
    const result = await isSafeExternalUrl(urlString);
    dnsCache.set(hostname, result);
    return result;
  } catch {
    return false;
  }
}

// ── Stream headers cache ────────────────────────────────────────────────────
// proxySegment does a DB query on every segment request to get user-agent/referer.
// For a 2s segment interval that's 30 queries/min per active viewer.
// Cache per streamId for 60s — headers change only when admin edits the stream.
const streamHeadersCache = new BoundedCache(500, 60 * 1000);

async function getStreamHeaders(streamId) {
  const cached = streamHeadersCache.get(streamId);
  if (cached !== undefined) return cached.data;
  try {
    const csRes = await db.query(
      'SELECT user_agent, referer, origin, headers_json, health_status, is_hidden FROM channel_streams WHERE id = $1',
      [streamId]
    );
    const stream = csRes.rows.length > 0 ? csRes.rows[0] : null;
    streamHeadersCache.set(streamId, stream);
    return stream;
  } catch {
    return null;
  }
}

// Fix #8: Add depth counter to prevent infinite redirect loops
// Fix #6: Increased timeout from 8s → 20s — live HLS sources from slow CDNs
// frequently take 10–15s to respond, causing unnecessary stream failures at 8s.
async function makeProxyRequest(url, headers, redirectDepth = 0) {
  if (redirectDepth > 5) {
    throw new Error('Too many redirects');
  }

  // SSRF check on every hop — a redirect could point to an internal address
  const safe = await isSafeExternalUrl(url);
  if (!safe) {
    const err = new Error('SSRF: target URL resolves to a blocked address');
    err.statusCode = 400;
    throw err;
  }

  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch(e) { return reject(e); }
    const isHttps = parsed.protocol === 'https:';
    const client  = isHttps ? https : http;
    const agent   = isHttps ? httpsAgent : httpAgent;  // ← keepAlive pool

    const req = client.request(url, { headers, agent, timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect with incremented depth counter, re-checking SSRF on each hop
        const nextUrl = resolveUrl(url, res.headers.location);
        return resolve(makeProxyRequest(nextUrl, headers, redirectDepth + 1));
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

function getExtension(urlStr) {
  try {
    const p = new URL(urlStr).pathname;
    const match = p.match(/\.([a-zA-Z0-9]+)$/);
    if (match) return `.${match[1]}`;
  } catch(e) {}
  if (urlStr.includes('.m3u8')) return '.m3u8';
  if (urlStr.includes('.mp4')) return '.mp4';
  if (urlStr.includes('.m4s')) return '.m4s';
  if (urlStr.includes('.aac')) return '.aac';
  return '.ts';
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
    console.log(`[proxy] manifest streamId=${streamId} channel="${stream.channel_name || stream.name || 'unknown'}" url=${stream_url.substring(0, 80)}`);

    // Check manifest cache (after auth so we don't cache responses for unauthorized requests).
    // Cache key includes the user: segment tokens are encrypted per-user, so a manifest
    // cached for user A would fail token decryption when served to user B.
    const manifestUserId = req.user?.id || 'anon';
    const manifestCacheKey = `${streamId}:${manifestUserId}`;
    const cachedManifest = manifestCache.get(manifestCacheKey);
    if (cachedManifest) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      return res.send(typeof cachedManifest === 'object' && cachedManifest.data ? cachedManifest.data : cachedManifest);
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

    // Only include Referer/Origin when explicitly set — sending unwanted headers to
    // hotlink-protected CDNs causes 403s (same rule as channelController.compileHeaders).
    const manifestHeaders = {};
    const mua = stream.user_agent && stream.user_agent.trim();
    if (mua) manifestHeaders['User-Agent'] = mua;
    const mref = stream.referer && stream.referer.trim();
    if (mref) manifestHeaders['Referer'] = mref;
    const morigin = stream.origin && stream.origin.trim();
    if (morigin) manifestHeaders['Origin'] = morigin;
    Object.assign(manifestHeaders, safeExtraHeaders);
    const headers = manifestHeaders;

    const manifestFetchStart = Date.now();
    const proxyRes = await makeProxyRequest(stream_url, headers);
    const manifestFetchMs = Date.now() - manifestFetchStart;
    if (manifestFetchMs > 3000) {
      console.warn(`[proxy] slow manifest upstream_fetch_ms=${manifestFetchMs} streamId=${streamId}`);
    }

    // Fix #1: Also accept 206 Partial Content — many CDN/live stream servers return 206
    // for range requests. Previously this was rejected as an error, killing the stream.
    if (proxyRes.statusCode !== 200 && proxyRes.statusCode !== 206) {
      console.warn(`[proxy] manifest upstream status=${proxyRes.statusCode} streamId=${streamId} fetchMs=${manifestFetchMs}`);
      return res.status(proxyRes.statusCode).send('Upstream error');
    }

    let body = '';
    proxyRes.setEncoding('utf8');
    for await (const chunk of proxyRes) body += chunk;

    // Guard: if the upstream returns HTML (captcha/redirect) instead of m3u8,
    // do NOT cache or serve it — it would poison the manifest cache and break playback.
    if (body.trimStart().startsWith('<')) {
      console.warn('[proxy] Upstream manifest returned HTML — captcha or redirect for stream:', streamId);
      return res.status(502).send('Upstream returned invalid manifest');
    }
    if (!body.includes('#EXTM3U')) {
      console.warn('[proxy] Upstream manifest missing #EXTM3U for stream:', streamId);
      return res.status(502).send('Upstream returned invalid manifest');
    }

    // Rewrite URLs — encrypt each segment URL so the original source is never exposed.
    // The client only sees an opaque AES-GCM ciphertext token, not the real URL.
    const userId = manifestUserId;
    const baseUrl = stream_url;
    const lines = body.split('\n');
    
    function rewriteUri(uriStr) {
      const fullUrl = resolveUrl(baseUrl, uriStr);
      if (!fullUrl) return uriStr;
      const token = encryptSegmentUrl(fullUrl, streamId, userId);
      const ext = getExtension(fullUrl);
      return `/api/proxy/segment/${streamId}/${token}${ext}`;
    }

    const rewritten = lines.map(line => {
      const t = line.trim();
      if (!t) return line;
      
      // Handle tags with URIs (e.g. #EXT-X-MAP:URI="init.mp4", #EXT-X-KEY:URI="...", #EXT-X-MEDIA:URI="...")
      if (t.startsWith('#EXT-X-MAP:') || t.startsWith('#EXT-X-KEY:') || t.startsWith('#EXT-X-MEDIA:')) {
        const uriMatch = t.match(/URI="([^"]+)"/);
        if (uriMatch) {
          const originalUri = uriMatch[1];
          const proxyUri = rewriteUri(originalUri);
          return t.replace(`URI="${originalUri}"`, `URI="${proxyUri}"`);
        }
        return line;
      }
      
      // Other tags are preserved as-is
      if (t.startsWith('#')) return line;
      
      // Raw segment or variant URL
      return rewriteUri(t);
    }).join('\n');

    // Only cache MASTER playlists. Do NOT cache MEDIA playlists.
    // Caching a live media playlist causes the player to receive stale segments,
    // which makes the player spam the server in an infinite loop asking for new segments
    // until the cache expires, causing the "loading -> playing -> loading" buffering loop.
    if (body.includes('#EXT-X-STREAM-INF')) {
      manifestCache.set(manifestCacheKey, rewritten);
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    // Allow browser HLS players to read the manifest from any origin (needed for
    // HLS.js ABR probing which may fetch from the JS execution origin).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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
    let tokenUserId = 'anon';
    try {
      const cleanToken = segToken.replace(/\.[a-zA-Z0-9]+$/, '');
      const decrypted = decryptSegmentToken(cleanToken, streamId);
      targetUrl = decrypted.url;
      tokenUserId = decrypted.userId || 'anon';
    } catch (tokenErr) {
      console.warn('[proxy] segment token invalid:', tokenErr.message);
      return res.status(403).send('Invalid or expired segment token');
    }

    // SSRF prevention — use cached DNS lookup (same security guarantee, zero per-segment overhead).
    {
      const safe = await isSafeExternalUrlCached(targetUrl).catch(() => false);
      if (!safe) {
        console.warn('[proxy] SSRF blocked:', targetUrl.slice(0, 80));
        return res.status(400).send('Invalid segment URL');
      }
    }

    // Fetch stream headers from 60-second in-process cache (was a DB round-trip every segment).
    const stream = await getStreamHeaders(streamId);
    if (stream?.is_hidden) return res.status(404).send('Stream not available');

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

    // Same "only send when explicitly set" rule as compileHeaders and proxyManifest.
    const segHeaders = {};
    const sua = stream?.user_agent && stream.user_agent.trim();
    if (sua) segHeaders['User-Agent'] = sua;
    const sref = stream?.referer && stream.referer.trim();
    if (sref) segHeaders['Referer'] = sref;
    const sorigin = stream?.origin && stream.origin.trim();
    if (sorigin) segHeaders['Origin'] = sorigin;
    Object.assign(segHeaders, safeExtraHeaders);
    const headers = segHeaders;

    // Fix #8: Use smart retry helper with exponential backoff and 4xx fast-fail
    let proxyRes;
    const fetchStart = Date.now();
    try {
      proxyRes = await fetchSegmentWithRetry(targetUrl, headers);
    } catch (e) {
      const fetchMs = Date.now() - fetchStart;
      console.warn(`[proxy] segment fetch failed streamId=${streamId} fetchMs=${fetchMs}ms err=${e.message}`);
      return res.status(502).send('Upstream segment unavailable');
    }
    const fetchMs = Date.now() - fetchStart;
    // Log slow upstream segment fetches (>2s) so latency issues are measurable, not guesswork
    if (fetchMs > 2000) {
      console.warn(`[proxy] slow segment upstream_fetch_ms=${fetchMs} streamId=${streamId} url=${targetUrl.slice(0, 60)}`);
    }

    // Fix #1: Also accept 206 Partial Content from upstream CDNs
    if (proxyRes.statusCode !== 200 && proxyRes.statusCode !== 206) {
      return res.status(proxyRes.statusCode).send('Upstream error');
    }

    // Guard: some CDNs return 200 with an HTML captcha/redirect page when the
    // stream has expired or geo-blocked. Serving HTML as video/mp2t causes
    // the player to error with "invalid data" — detect it early and 502.
    const upstreamCT = (proxyRes.headers['content-type'] || '').toLowerCase();
    if (upstreamCT.startsWith('text/html') || upstreamCT.startsWith('application/xhtml')) {
      console.warn('[proxy] Upstream returned HTML for segment — likely captcha/redirect:', targetUrl.slice(0, 80));
      return res.status(502).send('Upstream returned non-video content');
    }

    // Stream the data directly to the client, preserving the upstream Content-Type.
    // This is critical because some segments are actually child .m3u8 playlists,
    // and ExoPlayer will crash if a playlist is served as video/mp2t.
    let contentType = upstreamCT;
    if (!contentType) {
      if (targetUrl.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
      else if (targetUrl.includes('.m4s')) contentType = 'video/iso.segment';
      else if (targetUrl.includes('.mp4')) contentType = 'video/mp4';
      else if (targetUrl.includes('.aac')) contentType = 'audio/aac';
      else contentType = 'video/mp2t';
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    // Forward Content-Length so the browser ABR algorithm can measure segment download
    // speed accurately. Without this, the browser treats each segment as unknown-size
    // chunked data and underestimates bandwidth, causing unnecessary quality drops.
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    // Forward byte-range info for CDNs that return partial content (206)
    if (proxyRes.statusCode === 206 && proxyRes.headers['content-range']) {
      res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }

    const isM3u8 = targetUrl.includes('.m3u8') || (contentType && contentType.includes('mpegurl'));

    if (isM3u8) {
      let body = '';
      proxyRes.setEncoding('utf8');
      for await (const chunk of proxyRes) body += chunk;

      const userId = tokenUserId;
      const baseUrl = targetUrl;
      const lines = body.split('\n');

      function rewriteUri(uriStr) {
        const fullUrl = resolveUrl(baseUrl, uriStr);
        if (!fullUrl) return uriStr;
        const token = encryptSegmentUrl(fullUrl, streamId, userId);
        const ext = getExtension(fullUrl);
        return `/api/proxy/segment/${streamId}/${token}${ext}`;
      }

      const rewritten = lines.map(line => {
        const t = line.trim();
        if (!t) return line;
        
        // Handle tags with URIs (e.g. #EXT-X-MAP:URI="init.mp4", #EXT-X-KEY:URI="...", #EXT-X-MEDIA:URI="...")
        if (t.startsWith('#EXT-X-MAP:') || t.startsWith('#EXT-X-KEY:') || t.startsWith('#EXT-X-MEDIA:')) {
          const uriMatch = t.match(/URI="([^"]+)"/);
          if (uriMatch) {
            const originalUri = uriMatch[1];
            const proxyUri = rewriteUri(originalUri);
            return t.replace(`URI="${originalUri}"`, `URI="${proxyUri}"`);
          }
          return line;
        }
        
        // Other tags are preserved as-is
        if (t.startsWith('#')) return line;
        
        // Raw segment or variant URL
        return rewriteUri(t);
      }).join('\n');
      
      return res.send(rewritten);
    }

    // Fix #9: Use stream.pipeline() instead of proxyRes.pipe(res).
    // pipeline() handles backpressure properly — if the client reads slowly,
    // it pauses the upstream read instead of buffering unboundedly in memory.
    // It also auto-destroys both streams on error or completion.
    //
    // "Premature close" and "aborted" are NORMAL for live IPTV — they happen whenever
    // the viewer switches channels or the tab is closed. Suppress them to keep logs clean.
    
    // Performance Telemetry for Proxy Segments
    const contentLength = proxyRes.headers['content-length'] || 'unknown';
    console.info(`[proxy_telemetry] segment streamed streamId=${streamId} fetchMs=${fetchMs}ms bytes=${contentLength} url=${targetUrl.substring(0, 80)}`);
    pipeline(proxyRes, res, (err) => {
      if (!err) return;
      const isPrematureClose =
        err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        err.code === 'ERR_STREAM_DESTROYED'       ||
        err.code === 'ECONNRESET'                 ||
        err.code === 'EPIPE'                      ||
        err.message === 'aborted'                 ||
        err.message === 'Premature close';
      if (!isPrematureClose) {
        console.warn('[proxy] segment pipeline error:', err.code || err.message);
      }
      // Headers already sent at this point — nothing more to send to client
    });

  } catch (err) {
    console.error('proxySegment outer err:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
};
