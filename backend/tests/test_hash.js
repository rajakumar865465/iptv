const assert = require('assert');
const { encryptSegmentUrl } = require('../src/utils/proxyToken');
const crypto = require('node:crypto');

// Setup mock env variables
process.env.PROXY_SEGMENT_SECRET = 'test_secret_for_hash';

console.log('--- Running Proxy Hash Cache Test ---');

try {
  // Test 1: identical input produces identical cache keys (stable init token)
  const initUrl = 'http://example.com/stream/init.mp4?timestamp=12345';
  const token1 = encryptSegmentUrl(initUrl, 695, 1);
  const token2 = encryptSegmentUrl(initUrl, 695, 1);
  assert.strictEqual(token1, token2, 'Deterministic init token failed (identical input must produce identical tokens)');

  // Test 2: Normalized URLs produce identical keys
  const initUrlQuery2 = 'http://example.com/stream/init.mp4?timestamp=99999';
  const token3 = encryptSegmentUrl(initUrlQuery2, 695, 1);
  assert.strictEqual(token1, token3, 'URL normalization failed (queries should be ignored)');

  // Test 3: different input produces different keys
  const reallyDiffUrl = 'http://example.com/stream2/init.mp4';
  const token4 = encryptSegmentUrl(reallyDiffUrl, 695, 1);
  assert.notStrictEqual(token1, token4, 'Different input must produce different tokens');

  // Test 4: empty input handled safely
  const token5 = encryptSegmentUrl('', 695, 1);
  assert.ok(token5, 'Empty input should return a valid token');

  // Test 5: Unicode URL handled safely
  const unicodeUrl = 'http://example.com/init_🚀.mp4';
  const token6 = encryptSegmentUrl(unicodeUrl, 695, 1);
  assert.ok(token6, 'Unicode URL should return a valid token');
  
  // Test 6: Verify crypto.createHash works natively as required by cache controller
  const testHash = crypto.createHash('md5').update('init:695:http://example.com/stream/init.mp4').digest('hex');
  assert.ok(testHash, 'crypto.createHash should generate a hash safely');

  console.log('✅ All hash tests passed successfully.');
} catch (error) {
  console.error('❌ Hash test failed:', error.message);
  process.exit(1);
}
