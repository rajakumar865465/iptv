const { jwtVerify } = require('jose');
const jwt = require('jsonwebtoken');

async function test() {
  const secretString = 'mysecret_12345';
  
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
