const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const sharp = require('sharp');

// Create the public logos directory if it doesn't exist
const publicLogosDir = path.join(__dirname, '..', 'public', 'logos');
if (!fs.existsSync(publicLogosDir)) {
  fs.mkdirSync(publicLogosDir, { recursive: true });
}

// Check if a channel matches the manual Doordarshan / Sansad TV list
const getFallbackInitials = (name) => {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm.includes('ddnational')) return 'DD N';
  if (norm.includes('ddnews')) return 'DD News';
  if (norm.includes('ddindia')) return 'DD India';
  if (norm.includes('ddsports')) return 'DD Sports';
  if (norm.includes('ddbangla')) return 'DD Bangla';
  if (norm.includes('ddpunjabi')) return 'DD Punjabi';
  if (norm.includes('ddtamil')) return 'DD Tamil';
  if (norm.includes('ddsahyadri')) return 'DD Sahyadri';
  if (norm.includes('ddgirnar')) return 'DD Girnar';
  if (norm.includes('ddodia')) return 'DD Odia';
  if (norm.includes('ddassam')) return 'DD Assam';
  if (norm.includes('sansadtv') || norm.includes('sansad')) return 'Sansad';
  return null;
};

// Generates a clean text-based PNG logo with channel initials using sharp SVG rendering
const generateFallbackLogo = async (name, initials, outputPath) => {
  const width = 200;
  const height = 200;

  // Curated premium background colors
  const colors = [
    { bg: '#0D47A1', text: '#FFFFFF' }, // Dark Blue
    { bg: '#B71C1C', text: '#FFFFFF' }, // Dark Red
    { bg: '#1B5E20', text: '#FFFFFF' }, // Dark Green
    { bg: '#E65100', text: '#FFFFFF' }, // Dark Orange
    { bg: '#4A148C', text: '#FFFFFF' }, // Dark Purple
    { bg: '#006064', text: '#FFFFFF' }, // Teal
    { bg: '#3E2723', text: '#FFFFFF' }, // Dark Brown
    { bg: '#263238', text: '#FFFFFF' }, // Blue Grey
  ];

  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = colors[hash % colors.length];

  // Dynamic SVG template
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color.bg}" rx="32" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="${color.text}">${initials}</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
};

// Helper function to process a single channel's logo
async function processChannelLogo(channel) {
  const { id, name, logo_url } = channel;
  const outputPath = path.join(publicLogosDir, `${id}.png`);
  const relativePath = `/logos/${id}.png`;

  // 1. Missing logo_url handling
  if (!logo_url || logo_url.trim().length === 0) {
    const initials = getFallbackInitials(name);
    if (initials) {
      try {
        await generateFallbackLogo(name, initials, outputPath);
        await db.query(
          `UPDATE channels SET logo_status = 'fallback_generated', local_logo_url = $1, logo_checked_at = NOW(), logo_error = NULL WHERE id = $2`,
          [relativePath, id]
        );
        console.log(`[Generated Fallback] DD/Sansad channel "${name}" saved to local cache`);
        return;
      } catch (err) {
        console.error(`[Fallback Error] Failed to generate fallback for "${name}":`, err.message);
      }
    }

    await db.query(
      `UPDATE channels SET logo_status = 'missing', local_logo_url = NULL, logo_checked_at = NOW(), logo_error = NULL WHERE id = $1`,
      [id]
    );
    console.log(`[Missing] Channel "${name}" has no logo url`);
    return;
  }

  // 2. Fetch and decode external logo
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(logo_url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('image/')) {
      throw new Error(`Invalid content-type: ${contentType}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Attempt to decode and convert to PNG using sharp
    await sharp(buffer)
      .png()
      .toFile(outputPath);

    // Success! Update DB
    await db.query(
      `UPDATE channels SET logo_status = 'valid', local_logo_url = $1, logo_checked_at = NOW(), logo_error = NULL WHERE id = $2`,
      [relativePath, id]
    );
    console.log(`[Valid] Channel "${name}" logo cached successfully`);
  } catch (err) {
    const errorMsg = err.message || 'Unknown error';
    console.log(`[Invalid/Failed] Channel "${name}" logo check failed: ${errorMsg}`);

    // If it's a critical Doordarshan/Sansad channel, generate fallback PNG
    const initials = getFallbackInitials(name);
    if (initials) {
      try {
        await generateFallbackLogo(name, initials, outputPath);
        await db.query(
          `UPDATE channels SET logo_status = 'fallback_generated', local_logo_url = $1, logo_checked_at = NOW(), logo_error = $2 WHERE id = $3`,
          [relativePath, `Download error: ${errorMsg}. Fallback generated.`, id]
        );
        console.log(`[Generated Fallback] Critical channel "${name}" recovered with fallback PNG`);
        return;
      } catch (fErr) {
        console.error(`[Fallback Recovery Error] Failed to generate recovery fallback for "${name}":`, fErr.message);
      }
    }

    // Otherwise, clear local logo URL so app shows the clean Flutter initials fallback avatar
    await db.query(
      `UPDATE channels SET logo_status = 'invalid', local_logo_url = NULL, logo_checked_at = NOW(), logo_error = $1 WHERE id = $2`,
      [errorMsg, id]
    );
  }
}

// Batch runner
async function checkLogos() {
  console.log('Fetching active channels for logo validation...');
  const res = await db.query(
    `SELECT id, name, logo_url, local_logo_url FROM channels WHERE status = 'active' ORDER BY id ASC`
  );
  
  const channels = res.rows;
  console.log(`Found ${channels.length} active channels to check.`);

  // Process in batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(channels.length / BATCH_SIZE)}...`);
    await Promise.all(batch.map(channel => processChannelLogo(channel)));
  }

  console.log('Logo validation and caching process completed!');
  await db.pool.end();
}

checkLogos().catch(err => {
  console.error('Logo check execution error:', err);
  process.exit(1);
});
