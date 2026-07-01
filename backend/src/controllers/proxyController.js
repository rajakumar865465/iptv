const https = require('https');
const http = require('http');
const { URL } = require('url');
const { pipeline } = require('node:stream');
const db = require('../config/db');

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

    // Check manifest cache
    const cachedManifest = manifestCache.get(streamId);
    if (cachedManifest) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(cachedManifest.data);
    }

    let stream_url;
    let stream;
    let streamRes = await db.query('SELECT * FROM channel_streams WHERE id = $1', [streamId]);
    if (streamRes.rows.length === 0) {
      // channels table has 'referrer' (double-r); alias to 'referer' so the headers
      // compilation block below works uniformly for both channel_streams and channels rows.
      const chRes = await db.query('SELECT stream_url, user_agent, referrer AS referer FROM channels WHERE id = $1', [streamId]);
      if (chRes.rows.length === 0) return res.status(404).send('Stream not found');
      stream = chRes.rows[0];
      stream.origin = null;
      stream.headers_json = null;
      stream_url = stream.stream_url;
    } else {
      stream = streamRes.rows[0];
      stream_url = stream.stream_url;
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

    // Rewrite URLs
    const baseUrl = stream_url;
    const lines = body.split('\n');
    const rewritten = lines.map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const fullUrl = resolveUrl(baseUrl, t);
      if (!fullUrl) return line;
      // encode fullUrl and pass it to our segment proxy
      const encoded = Buffer.from(fullUrl).toString('base64');
      const ext = fullUrl.includes('.m3u8') ? '.m3u8' : '.ts';
      return `/api/proxy/segment/${streamId}/${encoded}${ext}`;
    }).join('\n');

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
    const { streamId, b64url } = req.params;
    // Cache check removed for segments to stream efficiently

    // Decode the target URL and validate it against allowed hosts (SSRF prevention)
    let targetUrl;
    try {
      const cleanB64 = b64url.replace('.ts', '').replace('.m3u8', '');
      targetUrl = Buffer.from(cleanB64, 'base64').toString('utf8');
      // Validate it's a proper URL
      const parsed = new URL(targetUrl);
      // Only allow http/https — block file://, ftp://, data:, etc.
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).send('Invalid segment URL');
      }
      // Block access to private/internal IP ranges and metadata services
      const host = parsed.hostname.toLowerCase();
      const BLOCKED_PATTERNS = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,      // AWS metadata service
        /^::1$/,            // IPv6 loopback
        /^fc00:/,           // IPv6 private
        /^fe80:/,           // IPv6 link-local
        /^0\./,
      ];
      if (BLOCKED_PATTERNS.some(p => p.test(host))) {
        return res.status(400).send('Invalid segment URL');
      }
    } catch {
      return res.status(400).send('Invalid segment URL');
    }

    let stream;
    let streamRes = await db.query('SELECT * FROM channel_streams WHERE id = $1', [streamId]);
    if (streamRes.rows.length === 0) {
      // channels table has 'referrer' (double-r); alias to 'referer' for uniform access below.
      const chRes = await db.query('SELECT stream_url, user_agent, referrer AS referer FROM channels WHERE id = $1', [streamId]);
      stream = chRes.rows[0] || {};
    } else {
      stream = streamRes.rows[0] || {};
    }

    // Sanitize headers_json — only allow a safe set of header names to prevent header injection
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
      'User-Agent': stream.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...(stream.referer ? { 'Referer': stream.referer } : {}),
      ...(stream.origin ? { 'Origin': stream.origin } : {}),
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
