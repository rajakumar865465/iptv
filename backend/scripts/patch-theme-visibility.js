'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

// 1. payment/pending/[orderId]/page.tsx
const p1 = path.join(root, 'frontend', 'src', 'app', '(public)', 'payment', 'pending', '[orderId]', 'page.tsx');
let c1 = fs.readFileSync(p1, 'utf8');
c1 = c1.replace(
  /className="inline-block px-8 py-3 bg-\[var\(--color-surface\)\] hover:bg-\[var\(--color-surface-2\)\] text-white rounded-xl font-bold transition-all border border-\[var\(--color-line\)\]"/,
  'className="inline-block px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-600/20"'
);
fs.writeFileSync(p1, c1, 'utf8');
console.log('1. payment/pending updated');

// 2. payment/failed/page.tsx
const p2 = path.join(root, 'frontend', 'src', 'app', '(public)', 'payment', 'failed', 'page.tsx');
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(
  'bg-red-600 hover:bg-red-700 text-[var(--color-ink)]',
  'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
);
fs.writeFileSync(p2, c2, 'utf8');
console.log('2. payment/failed updated');

// 3. browse/page.tsx
const p3 = path.join(root, 'frontend', 'src', 'app', '(public)', 'browse', 'page.tsx');
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace(
  "'bg-brand-500 text-[var(--color-ink)] shadow-lg shadow-brand-500/20 border border-brand-500'",
  "'bg-brand-500 text-white shadow-lg shadow-brand-500/20 border border-brand-500'"
);
fs.writeFileSync(p3, c3, 'utf8');
console.log('3. browse updated');

// 4. pricing/page.tsx
const p4 = path.join(root, 'frontend', 'src', 'app', '(public)', 'pricing', 'page.tsx');
let c4 = fs.readFileSync(p4, 'utf8');
c4 = c4.replace('border-slate-700/50', 'border-[var(--color-line)]');
fs.writeFileSync(p4, c4, 'utf8');
console.log('4. pricing updated');

console.log('All theme visibility fixes applied!');
