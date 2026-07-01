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
        
        console.log('Deleting all channels...');
        // Using DELETE instead of TRUNCATE to safely trigger ON DELETE CASCADE 
        // without requiring high privileges, but we could also use TRUNCATE.
        // TRUNCATE TABLE channels CASCADE is much faster.
        const res = await pool.query('TRUNCATE TABLE channels CASCADE');
        
        // Reset the sequence so new channels start from ID 1
        await pool.query('ALTER SEQUENCE channels_id_seq RESTART WITH 1');
        
        console.log('✅ Successfully deleted all channels and reset the ID sequence to 1.');
        
    } catch (err) {
        console.error('Error deleting channels:', err);
    } finally {
        await pool.end();
    }
}

main();
