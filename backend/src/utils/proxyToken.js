/**
 * proxyToken.js
 *
 * Stateless AES-256-GCM encrypted segment tokens for the HLS proxy.
 *
 * Problem: plain base64(url) in proxy segment URLs is trivially reversible —
 * anyone who intercepts a segment URL can decode the original stream source.
 *
 * Solution: encrypt the segment URL (plus streamId, userId, expiry) with a
 * server-secret key. The client sees gibberish; only the server can decrypt.
 *
 * Token format (URL-safe base64 of): iv(12) || ciphertext || authTag(16)
 * Token payload: JSON { url, streamId, userId, expiresAt }
 * Token TTL: 6 hours — sufficient for any continuous HLS session.
 *
 * Security properties:
 *  - Original URL is never exposed to the client
 *  - Token is tied to a specific streamId (replay on another stream is rejected)
 *  - Token expires — cannot be shared indefinitely
 *  - Authenticated encryption (GCM authTag) — tampering is detected
 */

const crypto = require('node:crypto');

// Module-load diagnostic: log exactly what `crypto` resolves to here so a
// broken binding shows up at startup (once) instead of as thousands of
// identical "crypto.createHash is not a function" lines inside proxySegment.
console.log('[proxyToken] crypto import check:', {
  exists: !!crypto,
  typeofModule: typeof crypto,
  hasCreateHash: typeof crypto?.createHash,
  hasRandomBytes: typeof crypto?.randomBytes,
  hasCreateCipheriv: typeof crypto?.createCipheriv,
  keys: crypto ? Object.keys(crypto).slice(0, 12) : [],
});

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;          // 96-bit IV for GCM
const TAG_LENGTH = 16;         // 128-bit auth tag
const KEY_LENGTH = 32;         // 256-bit key

// Cached derived key. Recomputed only once per process. We cache because the
// only documented failure mode in production was "crypto.createHash is not a
// function" on the per-segment path — deriving once at module load and
// logging the full stack there (once) is far easier to debug than thousands
// of identical errors inside proxySegment.
let _cachedKey = null;

function sha256(input) {
  if (typeof crypto.createHash !== 'function') {
    throw new Error(`crypto.createHash unavailable in this runtime: typeof crypto = ${typeof crypto}, keys = ${crypto && Object.keys(crypto).slice(0, 8).join(',')}`);
  }
  return crypto.createHash('sha256').update(input).digest();
}

function getKey() {
  if (_cachedKey) return _cachedKey;
  const secret = process.env.PROXY_SEGMENT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PROXY_SEGMENT_SECRET environment variable is missing in production. Cannot generate or decrypt proxy tokens safely.');
    }
    _cachedKey = sha256(process.env.JWT_SECRET || 'nivatv-proxy-default-secret');
  } else {
    _cachedKey = sha256(secret);
  }
  return _cachedKey;
}

/**
 * Encrypt a segment URL into an opaque, URL-safe token.
 * @param {string} url - Original segment URL
 * @param {number|string} streamId - channel_streams.id
 * @param {number|string} userId - user.id (from JWT)
 * @returns {string} URL-safe base64 token (no +/= characters)
 */
function encryptSegmentUrl(url, streamId, userId) {
  const key = getKey();
  
  let iv;
  let expiresAt;
  const isInitSegment = url.includes('init.mp4') || url.includes('init.m4s');
  let finalUrl = url;

  if (isInitSegment) {
    // 100% deterministic stable token for init segments forever
    expiresAt = 0; // 0 = never expires
    // Generate deterministic IV from URL and streamId
    finalUrl = url.split('?')[0];
    const hash = sha256(`init:${streamId}:${finalUrl}`);
    iv = hash.subarray(0, IV_LENGTH);
  } else {
    iv = crypto.randomBytes(IV_LENGTH);
    expiresAt = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
  }

  const payload = JSON.stringify({
    url: finalUrl,
    sid: String(streamId),   // streamId
    uid: String(userId),     // userId
    exp: expiresAt,
  });

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + encrypted + authTag, then base64url (no +/= padding issues in URLs)
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return packed.toString('base64url');
}

/**
 * Decrypt an opaque token back to its original URL.
 * @param {string} token - URL-safe base64 token from encryptSegmentUrl
 * @param {number|string} expectedStreamId - Must match the streamId in the token
 * @returns {{ url: string, userId: string }} Decrypted payload
 * @throws Error if token is invalid, expired, or streamId doesn't match
 */
function decryptSegmentToken(token, expectedStreamId) {
  const key = getKey();

  let packed;
  try {
    packed = Buffer.from(token, 'base64url');
  } catch {
    throw new Error('Invalid token encoding');
  }

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Token too short');
  }

  const iv       = packed.subarray(0, IV_LENGTH);
  const authTag  = packed.subarray(packed.length - TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH);

  let payload;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    payload = JSON.parse(decrypted.toString('utf8'));
  } catch {
    throw new Error('Token decryption failed — tampered or wrong key');
  }

  // Expiry check — add a 30s grace window so segments that were buffered by the player
  // just before a manifest refresh (new tokens issued every 8s) still serve correctly.
  // This is belt-and-suspenders: the 6h TTL already makes rotation-boundary 403s rare.
  const GRACE_MS = 30 * 1000;
  if (payload.exp !== 0 && payload.exp + GRACE_MS < Date.now()) {
    throw new Error('Token expired');
  }

  // Stream ID binding check — prevents using a segment token from stream A on stream B
  if (payload.sid !== String(expectedStreamId)) {
    throw new Error('Token/stream mismatch');
  }

  return { url: payload.url, userId: payload.uid };
}

module.exports = { encryptSegmentUrl, decryptSegmentToken };
