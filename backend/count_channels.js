const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const poolConfig = process.env.DATABASE_URL
? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    }
: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'iptv_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

async function main() {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM channels');
        console.log(`Total channels in DB: ${result.rows[0].count}`);
        
        const result2 = await pool.query('SELECT name FROM channels LIMIT 10');
        console.log('Sample channel names in DB:');
        result2.rows.forEach(r => console.log(`- ${r.name}`));
        
        await pool.end();
    } catch (e) {
        console.error(e);
    }
}
main();
