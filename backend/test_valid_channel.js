const { Client } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

const BASE = 'http://localhost:5000';

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Find valid channel
    // 1. Force setup a test channel
    const channelId = 10;
    const testStream = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    
    // Ensure channel 10 exists
    await client.query(`
      INSERT INTO channels (id, name, stream_url, health_status, is_hidden, is_removed, is_visible_app, smooth_playback_enabled, playback_delay_seconds, restream_mode)
      VALUES ($1, 'Test Smooth Playback', $2, 'online', false, false, true, true, 300, 'delayed')
      ON CONFLICT (id) DO UPDATE SET 
        stream_url = $2, health_status = 'online', is_hidden = false, is_removed = false, is_visible_app = true, smooth_playback_enabled = true, playback_delay_seconds = 300, restream_mode = 'delayed';
    `, [channelId, testStream]);

    // Ensure it has a stream
    await client.query('DELETE FROM channel_streams WHERE channel_id = $1', [channelId]);
    await client.query(`
      INSERT INTO channel_streams (channel_id, stream_url, license_type, health_status)
      VALUES ($1, $2, 'public', 'online')
    `, [channelId, testStream]);

    console.log(`Forced setup of channel ${channelId} with test stream ${testStream}`);

    // Note: To trigger the buffer recorder, we need to hit the API or wait for the scanner. 
    // Hitting the /api/channels/:id/smooth-playback endpoint triggers it in smoothPlaybackController.
    
    // 3. Monitor buffer growth
    for (let i = 0; i < 12; i++) {
      console.log(`\nCheck ${i + 1}/12...`);
      const apiRes = await fetch(`${BASE}/api/channels/${channelId}/smooth-playback`);
      const apiData = await apiRes.json();
      console.log(JSON.stringify(apiData.data || apiData, null, 2));
      
      if (apiData.data?.playlist_url || apiData.data?.delayed_stream_url) {
        const url = apiData.data.playlist_url || apiData.data.delayed_stream_url;
        console.log(`\nPlaylist available: ${url}`);
        const plRes = await fetch(url);
        const plText = await plRes.text();
        console.log(`Playlist has EXTM3U: ${plText.includes('#EXTM3U')}`);
        console.log(`Playlist has EVENT: ${plText.includes('#EXT-X-PLAYLIST-TYPE:EVENT')}`);
        if (!plText.includes('#EXT-X-PLAYLIST-TYPE:EVENT')) {
          console.log('✅ Success: Playlist behaves like sliding-window HLS (No EVENT type).');
        }
      }
      
      await new Promise(r => setTimeout(r, 5000));
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await client.end();
  }
}

run();
