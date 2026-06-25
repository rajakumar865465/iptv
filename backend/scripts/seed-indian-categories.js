/**
 * seed-indian-categories.js
 * Ensures all Indian categories exist in the DB with correct sort order.
 * Safe to re-run — uses upsert logic.
 *
 * Usage: node scripts/seed-indian-categories.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/config/db');

const INDIAN_CATEGORIES = [
  { name: 'Doordarshan',              sort_order: 1  },
  { name: 'Hindi Entertainment',      sort_order: 2  },
  { name: 'Hindi Movies',             sort_order: 3  },
  { name: 'Hindi News',               sort_order: 4  },
  { name: 'English News',             sort_order: 5  },
  { name: 'Business News',            sort_order: 6  },
  { name: 'Sports',                   sort_order: 7  },
  { name: 'Music',                    sort_order: 8  },
  { name: 'Kids',                     sort_order: 9  },
  { name: 'Devotional',               sort_order: 10 },
  { name: 'Education',                sort_order: 11 },
  { name: 'Tamil',                    sort_order: 12 },
  { name: 'Telugu',                   sort_order: 13 },
  { name: 'Malayalam',                sort_order: 14 },
  { name: 'Kannada',                  sort_order: 15 },
  { name: 'Bengali',                  sort_order: 16 },
  { name: 'Marathi',                  sort_order: 17 },
  { name: 'Punjabi',                  sort_order: 18 },
  { name: 'Gujarati',                 sort_order: 19 },
  { name: 'Odia',                     sort_order: 20 },
  { name: 'Assamese / North East',    sort_order: 21 },
  { name: 'Urdu',                     sort_order: 22 },
  { name: 'Bhojpuri',                 sort_order: 23 },
  { name: 'Lifestyle / Infotainment', sort_order: 24 },
  { name: 'English Movies',           sort_order: 25 },
  { name: 'International News',       sort_order: 26 },
  { name: 'Free FAST Channels',       sort_order: 27 },
  { name: 'General',                  sort_order: 28 },
];

async function seedCategories() {
  console.log('=== Seeding Indian Categories ===\n');
  let created = 0;
  let updated = 0;

  for (const cat of INDIAN_CATEGORIES) {
    const existing = await db.query('SELECT id FROM categories WHERE name = $1', [cat.name]);
    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE categories SET sort_order = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
        [cat.sort_order, existing.rows[0].id]
      );
      updated++;
    } else {
      await db.query(
        `INSERT INTO categories (name, icon_url, status, sort_order) VALUES ($1, '', 'active', $2)`,
        [cat.name, cat.sort_order]
      );
      console.log(`  + Created: ${cat.name}`);
      created++;
    }
  }

  console.log(`\nDone — Created: ${created}, Updated: ${updated}`);
  console.log(`Total categories: ${INDIAN_CATEGORIES.length}`);
  await db.pool.end();
  process.exit(0);
}

seedCategories().catch(err => {
  console.error('Category seed failed:', err);
  process.exit(1);
});
