// Sanity check that a token signed with `jsonwebtoken` can be verified by
// `jose` (i.e. the two libraries are interoperable for our use case). The
// secret only needs to exist for the duration of this script, so it is
// generated at runtime rather than hardcoded, and no real secret value ever
// needs to be committed or supplied externally.
const { jwtVerify } = require('jose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

async function test() {
  const secretString = crypto.randomBytes(32).toString('hex');

  // Create token with jsonwebtoken
  const token = jwt.sign({ userId: 1, role: 'admin' }, secretString, { expiresIn: '1d' });
  // console.log("Token:", token);

  // Verify with jose
  try {
    const secret = new TextEncoder().encode(secretString);
    const { payload } = await jwtVerify(token, secret);
    console.log("Verified! Payload:", payload);
  } catch (e) {
    console.error("Verification failed:", e.code, e.message);
  }
}
test();
