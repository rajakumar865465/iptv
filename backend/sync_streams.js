require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Refusing to connect without an explicit connection string.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

async function main() {
    try {
        await client.connect();

        // Find channels whose stream_url was updated to a healthy one (or updated recently)
        const result = await client.query(`
            SELECT id, stream_url FROM channels WHERE health_status = 'unknown' OR health_status = 'online'
        `);

        let updatedCount = 0;
        for (const row of result.rows) {
            // Update the primary stream in channel_streams
            const updateRes = await client.query(`
                UPDATE channel_streams 
                SET stream_url = $1, health_status = 'unknown'
                WHERE channel_id = $2 AND priority = 1
            `, [row.stream_url, row.id]);

            if (updateRes.rowCount > 0) {
                updatedCount++;
            } else {
                // If it doesn't have a priority 1 stream, just insert it or update any stream
                const updateAny = await client.query(`
                    UPDATE channel_streams 
                    SET stream_url = $1, health_status = 'unknown'
                    WHERE channel_id = $2
                `, [row.stream_url, row.id]);
                if (updateAny.rowCount > 0) updatedCount++;
                else {
                    // insert if missing
                    await client.query(`
                        INSERT INTO channel_streams (channel_id, stream_url, quality, priority, health_status, playback_mode)
                        VALUES ($1, $2, 'auto', 1, 'unknown', 'direct')
                    `, [row.id, row.stream_url]);
                    updatedCount++;
                }
            }
        }

        console.log(`Synced ${updatedCount} channels to channel_streams.`);
    } catch (e) {
        console.error(e);
    } finally {
        client.end();
    }
}
main();
