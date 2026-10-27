'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

// 1. frontend/next.config.ts
const ncPath = path.join(root, 'frontend', 'next.config.ts');
let nc = fs.readFileSync(ncPath, 'utf8');
if (!nc.includes('Permissions-Policy')) {
  nc = nc.replace(
    "{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },",
    "{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },\n          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")' },"
  );
  fs.writeFileSync(ncPath, nc, 'utf8');
  console.log('1. next.config.ts updated');
}

// 2. frontend/src/middleware.ts
const mwPath = path.join(root, 'frontend', 'src', 'middleware.ts');
let mw = fs.readFileSync(mwPath, 'utf8');
if (!mw.includes("{ algorithms: ['HS256'] }")) {
  mw = mw.replace(
    'const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));',
    "const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });"
  );
  fs.writeFileSync(mwPath, mw, 'utf8');
  console.log('2. middleware.ts updated');
}

// 3. backend/src/controllers/publicController.js
const pubPath = path.join(root, 'backend', 'src', 'controllers', 'publicController.js');
let pub = fs.readFileSync(pubPath, 'utf8');
pub = pub.replace(
  "return error(res, err.message || 'APK upload error', 400);",
  "return error(res, err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : (err.message === 'Only .apk files are allowed!' ? err.message : 'Invalid file upload'), 400);"
);
fs.writeFileSync(pubPath, pub, 'utf8');
console.log('3. publicController updated');

console.log('All patches applied cleanly!');
