const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

async function main() {
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
    
    try {
        console.log('Connecting to database...');
        
        console.log('Truncating channels...');
        await pool.query('TRUNCATE TABLE channels CASCADE');
        await pool.query('ALTER SEQUENCE channels_id_seq RESTART WITH 1');
        
        console.log('Inserting channels...');
        const sql = fs.readFileSync('../insert_channels.sql', 'utf8');
        await pool.query(sql);
        
        console.log('✅ Successfully truncated and inserted 61 channels into the Render (local) DB.');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
