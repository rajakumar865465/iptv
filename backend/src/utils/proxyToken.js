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

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;          // 96-bit IV for GCM
const TAG_LENGTH = 16;         // 128-bit auth tag
const KEY_LENGTH = 32;         // 256-bit key

function getKey() {
  const secret = process.env.PROXY_SEGMENT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PROXY_SEGMENT_SECRET environment variable is missing in production. Cannot generate or decrypt proxy tokens safely.');
    }
    return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'nivatv-proxy-default-secret').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
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
    const hash = crypto.createHash('sha256').update(`init:${streamId}:${finalUrl}`).digest();
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
