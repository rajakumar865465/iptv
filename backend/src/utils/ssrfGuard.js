'use strict';
/**
 * ssrfGuard.js
 *
 * The M3U importer lets an admin type in an arbitrary URL, and the backend
 * then makes an outbound request to it. That makes the backend a potential
 * SSRF vector (internal services, cloud metadata endpoints, etc.) unless we
 * validate every URL — including every redirect hop — before fetching it.
 */

const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const fetch = require('node-fetch');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.split(':').pop();
    if (v4 && v4.includes('.')) return isPrivateIPv4(v4);
  }
  return false;
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // unrecognized -> treat as unsafe
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`Blocked private/internal address: ${hostname}`);
    return;
  }
  if (hostname.toLowerCase() === 'localhost') throw new Error('Blocked localhost hostname');

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (e) {
    throw new Error(`DNS lookup failed for ${hostname}: ${e.message}`);
  }
  if (!addresses.length) throw new Error(`Could not resolve host: ${hostname}`);
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`Blocked private/internal address resolved for ${hostname}: ${address}`);
    }
  }
}

async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }
  await assertPublicHost(parsed.hostname);
  return parsed;
}

/**
 * Fetch a URL while guarding against SSRF. Redirects are followed manually
 * (one hop at a time) so every hop's host is re-validated instead of trusting
 * an automatic redirect chain that could jump to an internal address.
 */
async function safeFetch(rawUrl, { maxRedirects = 5, timeoutMs = 10000, headers = {} } = {}) {
  let currentUrl = rawUrl;
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...headers
  };

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(currentUrl, { redirect: 'manual', headers: fetchHeaders, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      currentUrl = new URL(res.headers.get('location'), currentUrl).href;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

module.exports = { assertSafeUrl, safeFetch, isPrivateIp };
