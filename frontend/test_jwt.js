// Manual/dev script for exercising jose's jwtVerify() against a handful of
// malformed or edge-case token strings (undefined, "null", 2-part tokens,
// tokens accidentally wrapped in URL-encoded quotes, etc). This is testing
// jose's parsing/error behavior, not a specific real credential, so we
// generate a throwaway signed token at runtime instead of committing a real
// (or realistic-looking) JWT/secret to source control.
const { jwtVerify } = require('jose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

async function test() {
  const throwawaySecret = crypto.randomBytes(32).toString('hex');
  const validToken = jwt.sign(
    { userId: 2, email: 'superadmin@example.test', role: 'admin' },
    throwawaySecret,
    { expiresIn: '1h' }
  );

  const strings = [
    undefined,
    'undefined',
    'null',
    validToken.split('.').slice(0, 2).join('.'), // malformed: only 2 parts
    `%22${validToken}%22`, // malformed: wrapped in URL-encoded quotes
    `${validToken}%22`, // malformed: trailing %22
  ];

  for (const s of strings) {
    try {
      await jwtVerify(s, new TextEncoder().encode(throwawaySecret));
      console.log(s, '=> OK');
    } catch (e) {
      console.log(s, '=>', e.code);
    }
  }
}

test();
