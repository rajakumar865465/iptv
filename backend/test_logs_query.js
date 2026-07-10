const db = require('./src/config/db');

async function testQuery() {
  const baseQuery = `
      SELECT * FROM (
        SELECT 
          created_at as timestamp,
          'error' as level,
          'backend' as source,
          error_message as message,
          status_code as "statusCode",
          NULL::int as "channelId",
          user_id as "userId",
          path as "requestPath",
          request_body as "errorDetails"
        FROM api_error_logs
        
        UNION ALL
        
        SELECT
          created_at as timestamp,
          'info' as level,
          'admin' as source,
          'Admin action: ' || action as message,
          NULL::int as "statusCode",
          NULL::int as "channelId",
          admin_id as "userId",
          NULL::varchar as "requestPath",
          details as "errorDetails"
        FROM admin_audit_logs
        
        UNION ALL
        
        SELECT
          created_at as timestamp,
          CASE WHEN status = 'failed' THEN 'error' WHEN status = 'completed' THEN 'success' ELSE 'info' END as level,
          'stream_scanner' as source,
          'Scanner job ' || status as message,
          NULL::int as "statusCode",
          NULL::int as "channelId",
          NULL::int as "userId",
          NULL::varchar as "requestPath",
          results as "errorDetails"
        FROM stream_scan_jobs
      ) unified_logs
    `;

  try {
    const res = await db.query(baseQuery + " LIMIT 1");
    console.log("Success:", res.rows);
  } catch (err) {
    console.error("SQL Error:", err.message);
  } finally {
    process.exit();
  }
}

testQuery();
