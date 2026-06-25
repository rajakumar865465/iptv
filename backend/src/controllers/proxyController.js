const https = require('https');
const http = require('http');
const { URL } = require('url');
const db = require('../config/db');

// In-memory cache for segments (very basic implementation)
const segmentCache = new Map();
const manifestCache = new Map();

const CACHE_MANIFEST_MS = 3000; // 3 seconds
const CACHE_SEGMENT_MS = 60000; // 60 seconds

function makeProxyRequest(url, headers) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch(e) { return reject(e); }
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(url, { headers, timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(makeProxyRequest(res.headers.location, headers)); // follow redirect once
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
    if (manifestCache.has(streamId)) {
      const cached = manifestCache.get(streamId);
      if (Date.now() - cached.time < CACHE_MANIFEST_MS) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.send(cached.data);
      }
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

    manifestCache.set(streamId, { time: Date.now(), data: rewritten });

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
    if (segmentCache.has(cacheKey)) {
      const cached = segmentCache.get(cacheKey);
      if (Date.now() - cached.time < CACHE_SEGMENT_MS) {
        res.setHeader('Content-Type', 'video/mp2t');
        return res.send(cached.data);
      } else {
        segmentCache.delete(cacheKey);
      }
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
    segmentCache.set(cacheKey, { time: Date.now(), data: fullBuffer });

  } catch (err) {
    res.status(500).end();
  }
};
