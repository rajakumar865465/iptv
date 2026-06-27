#!/usr/bin/env node
/**
 * diagnose-stream.js
 * Standalone CLI tool to run the stream diagnoser.
 * Usage:
 *   node scripts/diagnose-stream.js "STREAM_URL" [--headers='{"User-Agent": "..."}']
 */

const { diagnoseStream } = require('../src/utils/streamDiagnoser');

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const headersArg = args.find(a => a.startsWith('--headers='))?.split(/=(.+)/)[1] || null;

if (!url) {
  console.log('Usage: node scripts/diagnose-stream.js "STREAM_URL" [--headers=\'{"User-Agent": "..."}\']');
  process.exit(1);
}

let headers = {};
if (headersArg) {
  try {
    headers = JSON.parse(headersArg);
  } catch (e) {
    console.error('Failed to parse headers JSON:', e.message);
  }
}

async function main() {
  console.log(`Analyzing: ${url}`);
  const report = await diagnoseStream(url, headers);
  console.log('\n=== DIAGNOSTIC REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Diagnosis crashed:', err);
  process.exit(1);
});
