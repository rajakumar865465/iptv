const { Pool } = require('pg');

async function main() {
    console.log("Checking local DB (localhost, iptv_db, postgres, postgres)...");
    const pool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'iptv_db',
        user: 'postgres',
        password: 'postgres'
    });
    
    try {
        const res = await pool.query('SELECT COUNT(*) FROM channels');
        console.log(`Total channels in local DB: ${res.rows[0].count}`);
        
        // Also truncate it just in case
        if (parseInt(res.rows[0].count) > 0) {
            console.log("Deleting channels in local DB...");
            await pool.query('TRUNCATE TABLE channels CASCADE');
            await pool.query('ALTER SEQUENCE channels_id_seq RESTART WITH 1');
            console.log("✅ Successfully deleted local DB channels.");
        }
    } catch (err) {
        console.error('Error connecting to local DB:', err.message);
    } finally {
        await pool.end();
    }
}
main();
