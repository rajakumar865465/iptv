const https = require('https');
const http = require('http');
const { URL } = require('url');
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

const CACHE_MANIFEST_MS = 3000;  // 3 seconds
const CACHE_SEGMENT_MS = 60000;  // 60 seconds

const segmentCache = new BoundedCache(500, CACHE_SEGMENT_MS);
const manifestCache = new BoundedCache(200, CACHE_MANIFEST_MS);

// Fix #8: Add depth counter to prevent infinite redirect loops
function makeProxyRequest(url, headers, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 5) {
      return reject(new Error('Too many redirects'));
    }

    let parsed;
    try { parsed = new URL(url); } catch(e) { return reject(e); }
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(url, { headers, timeout: 8000 }, (res) => {
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

    const streamRes = await db.query('SELECT stream_url, user_agent, referer FROM channel_streams WHERE id = $1', [streamId]);
    if (streamRes.rows.length === 0) return res.status(404).send('Stream not found');
    const { stream_url, user_agent, referer } = streamRes.rows[0];

    const proxyRes = await makeProxyRequest(stream_url, {
      'User-Agent': user_agent || 'ExoPlayer',
      'Referer': referer || ''
    });

    if (proxyRes.statusCode !== 200) {
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
      return `/api/proxy/segment/${streamId}/${encoded}.ts`;
    }).join('\n');

    manifestCache.set(streamId, rewritten);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritten);
  } catch (err) {
    console.error('proxyManifest err:', err.message);
    res.status(500).send('Proxy error');
  }
};

exports.proxySegment = async (req, res) => {
  try {
    const { streamId, b64url } = req.params;
    const cacheKey = `${streamId}_${b64url}`;

    // Check segment cache
    const cachedSegment = segmentCache.get(cacheKey);
    if (cachedSegment) {
      res.setHeader('Content-Type', 'video/mp2t');
      return res.send(cachedSegment.data);
    }

    const targetUrl = Buffer.from(b64url.replace('.ts', ''), 'base64').toString('utf8');
    
    const streamRes = await db.query('SELECT user_agent, referer FROM channel_streams WHERE id = $1', [streamId]);
    const { user_agent, referer } = streamRes.rows[0] || {};

    let proxyRes;
    try {
      proxyRes = await makeProxyRequest(targetUrl, { 'User-Agent': user_agent || 'ExoPlayer', 'Referer': referer || '' });
    } catch(e) {
      // Retry once on failure
      proxyRes = await makeProxyRequest(targetUrl, { 'User-Agent': user_agent || 'ExoPlayer', 'Referer': referer || '' });
    }

    if (proxyRes.statusCode !== 200) {
      return res.status(proxyRes.statusCode).send('Upstream error');
    }

    const chunks = [];
    res.setHeader('Content-Type', 'video/mp2t');
    for await (const chunk of proxyRes) {
      chunks.push(chunk);
      res.write(chunk); // Stream directly to client
    }
    res.end();

    // Save to cache after streaming
    const fullBuffer = Buffer.concat(chunks);
    segmentCache.set(cacheKey, fullBuffer);

  } catch (err) {
    res.status(500).end();
  }
};
