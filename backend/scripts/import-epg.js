/**
 * EPG Guide Import Script
 * Downloads Indian EPG in XMLTV format, parses it, matches by channel name, and populates epg_programs table.
 * Usage: node scripts/import-epg.js
 */

require('dotenv').config();
const zlib = require('zlib');
const xml2js = require('xml2js');
const db = require('../src/config/db');

const EPG_URL = 'https://raw.githubusercontent.com/mitthu786/tvepg/main/epg.xml.gz';

// Parse XMLTV Date string (e.g. "20260624100000 +0530") to standard Date
function parseXMLTVDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-]\d{4})?$/);
  if (!match) return new Date(dateStr); // Fallback
  
  const [_, year, month, day, hour, minute, second, tz] = match;
  let iso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  if (tz) {
    const tzSign = tz[0];
    const tzHours = tz.slice(1, 3);
    const tzMins = tz.slice(3, 5);
    iso += `${tzSign}${tzHours}:${tzMins}`;
  } else {
    iso += 'Z';
  }
  return new Date(iso);
}

// Extract string value from xml2js tag
function getXMLValue(arr) {
  if (!arr || arr.length === 0) return null;
  const first = arr[0];
  if (typeof first === 'object' && first !== null) {
    return first._ || first.title || '';
  }
  return String(first);
}

// Clean and normalize names for fuzzy matching
function cleanName(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function importEPG() {
  console.log('=== EPG Import Script ===');
  console.log(`Downloading EPG guide from: ${EPG_URL}\n`);

  try {
    const response = await fetch(EPG_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const compressedBuffer = Buffer.from(arrayBuffer);
    
    console.log('Decompressing EPG file...');
    const xmlBuffer = zlib.gunzipSync(compressedBuffer);
    const xmlString = xmlBuffer.toString('utf8');
    console.log(`Uncompressed EPG size: ${(xmlString.length / (1024 * 1024)).toFixed(2)} MB`);

    console.log('Parsing XMLTV data...');
    const parserResult = await xml2js.parseStringPromise(xmlString);
    
    const tv = parserResult.tv || {};
    const channelsList = tv.channel || [];
    const programmesList = tv.programme || [];

    console.log(`Found ${channelsList.length} channels and ${programmesList.length} programs in EPG XML`);

    // Fetch active channels from DB
    const dbChannelsRes = await db.query(
      `SELECT id, name, language FROM channels WHERE status = 'active'`
    );
    
    // Map: cleanedName -> { id, language }
    const channelMap = new Map();
    dbChannelsRes.rows.forEach(ch => {
      channelMap.set(cleanName(ch.name), {
        id: ch.id,
        language: ch.language || 'English'
      });
    });

    console.log(`Active channels in local DB: ${channelMap.size}`);

    // Map: XML Channel ID -> { id, language }
    const xmlChannelIdMap = new Map();
    channelsList.forEach(xc => {
      if (!xc.$ || !xc.$.id) return;
      const displayName = getXMLValue(xc['display-name']);
      if (!displayName) return;
      const cleaned = cleanName(displayName);
      const localChannel = channelMap.get(cleaned);
      if (localChannel) {
        xmlChannelIdMap.set(xc.$.id.toLowerCase().trim(), localChannel);
      }
    });

    console.log(`Mapped XML channels to local DB: ${xmlChannelIdMap.size}`);

    // Map EPG programs to database rows
    const insertValues = [];
    let matchedCount = 0;

    for (const prog of programmesList) {
      if (!prog.$ || !prog.$.channel) continue;
      const xmlChannelId = prog.$.channel.toLowerCase().trim();
      
      const localChannel = xmlChannelIdMap.get(xmlChannelId);
      if (!localChannel) continue; // Skip if not mapped

      const title = getXMLValue(prog.title);
      if (!title) continue;

      const description = getXMLValue(prog.desc) || '';
      const startTime = parseXMLTVDate(prog.$.start);
      const endTime = parseXMLTVDate(prog.$.stop);
      const category = getXMLValue(prog.category) || 'General';

      if (!startTime || !endTime) continue;

      insertValues.push({
        channel_id: localChannel.id,
        source_channel_id: prog.$.channel,
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        category,
        language: localChannel.language
      });
      matchedCount++;
    }

    console.log(`Matched ${matchedCount} EPG programs to local channels`);

    if (insertValues.length === 0) {
      console.log('No EPG programs matched our local channels. Script exit.');
      return;
    }

    // Clear old EPG data
    console.log('Clearing old EPG data...');
    await db.query('DELETE FROM epg_programs');
    console.log('Old EPG data cleared');

    // Bulk insert new EPG programs in chunks
    console.log('Bulk inserting EPG programs...');
    const CHUNK_SIZE = 150;
    let inserted = 0;

    for (let i = 0; i < insertValues.length; i += CHUNK_SIZE) {
      const chunk = insertValues.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map((_, idx) => {
        const base = idx * 8;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
      }).join(',');

      const sql = `
        INSERT INTO epg_programs (
          channel_id, source_channel_id, title, description, 
          start_time, end_time, category, language
        ) VALUES ${placeholders}
      `;

      const flatVals = chunk.reduce((acc, row) => {
        acc.push(
          row.channel_id, 
          row.source_channel_id, 
          row.title, 
          row.description, 
          row.start_time, 
          row.end_time, 
          row.category, 
          row.language
        );
        return acc;
      }, []);

      await db.query(sql, flatVals);
      inserted += chunk.length;
      process.stdout.write(`  Inserted: ${inserted}/${insertValues.length}\r`);
    }

    console.log(`\n✅ EPG Import completed successfully. Imported ${insertValues.length} programs.`);

  } catch (err) {
    console.error('❌ EPG Import failed:', err.message);
    console.error(err.stack);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

importEPG();
