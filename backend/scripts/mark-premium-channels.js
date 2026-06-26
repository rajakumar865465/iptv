require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

async function markPremium() {
  const premiumKeywords = [
    'Star %', 'Sony %', 'Zee %', 'Colors %', 'Sun %',
    'Discovery%', 'History%', 'National Geographic%',
    'Cartoon Network', 'Pogo', 'Nickelodeon', 'Disney%',
    'HBO%', 'Warner%', 'MNX%', 'Movies Now%', 'Romedy Now%',
    'Jaya TV', 'Kalaignar TV', 'Vijay TV', 'Asianet%',
    'Sports18%', 'Eurosport%'
  ];

  let totalUpdated = 0;

  for (const keyword of premiumKeywords) {
    const res = await db.query(
      `UPDATE channels SET is_premium = true, is_paid = true WHERE name ILIKE $1`,
      [keyword]
    );
    if (res.rowCount > 0) {
      console.log(`Marked ${res.rowCount} channels as premium for keyword: ${keyword}`);
      totalUpdated += res.rowCount;
    }
  }

  // Also specifically mark these common exact names
  const exactNames = ['&TV', 'Bhojpuri Cinema', 'Enterr10', 'Atrangii'];
  for (const name of exactNames) {
    const res = await db.query(
      `UPDATE channels SET is_premium = true, is_paid = true WHERE name = $1`,
      [name]
    );
    if (res.rowCount > 0) {
      console.log(`Marked ${res.rowCount} channels as premium for exact name: ${name}`);
      totalUpdated += res.rowCount;
    }
  }

  console.log(`Total premium channels marked: ${totalUpdated}`);
  
  // Also, set their health_status to 'online' or at least 'unstable' so they aren't hidden by default
  // if they don't want to modify the backend code. But I will also modify backend code.
  const res2 = await db.query(`UPDATE channels SET health_status = 'unstable' WHERE is_premium = true AND health_status = 'offline'`);
  console.log(`Updated health_status to 'unstable' for ${res2.rowCount} offline premium channels.`);

  process.exit(0);
}

markPremium().catch(console.error);
