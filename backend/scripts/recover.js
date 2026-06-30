/**
 * CLI wrapper for running database recovery manually.
 * Usage: node scripts/recover.js
 */

const recovery = require('../src/utils/recovery');
const db = require('../src/config/db');

async function main() {
  try {
    console.log('--- Starting Manual Database Recovery ---');
    await recovery.runRecovery();
    console.log('--- Database Recovery Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Database Recovery Failed ---');
    console.error(error);
    process.exit(1);
  } finally {
    if (db && db.pool) {
      await db.pool.end();
    }
  }
}

main();
