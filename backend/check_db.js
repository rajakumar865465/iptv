const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://iptvdb:JdKD9dbx1wha4P5jyDMwU8NsE8z6wJNd@dpg-d8tbqf4m0tmc73c6j6hg-a.oregon-postgres.render.com/iptv_db2', ssl: { rejectUnauthorized: false } }); 
client.connect().then(() => {
  client.query("SELECT id, name, stream_url, health_status FROM channels LIMIT 5").then(res => { 
    console.log(res.rows); 
    client.end(); 
  })
}).catch(console.error);
