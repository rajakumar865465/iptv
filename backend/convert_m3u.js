const fs = require('fs');
const readline = require('readline');

async function convertToM3U(inputFile, outputFile) {
  const fileStream = fs.createReadStream(inputFile);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const m3uLines = ['#EXTM3U'];
  let currentGroup = 'Uncategorized';

  for await (const line of rl) {
    const trimmed = line.trim();
    
    // Skip empty lines or header lines
    if (!trimmed || trimmed.startsWith('===') || trimmed.startsWith('Working IPTV') || trimmed.startsWith('Generated:')) {
      continue;
    }

    // Detect Categories (e.g., ### Indian-Hindi  (410 channels))
    if (trimmed.startsWith('###')) {
      // Extract just the category name before any parentheses or numbers
      let categoryRaw = trimmed.replace(/^###\s*/, '');
      const parenIndex = categoryRaw.indexOf('(');
      if (parenIndex !== -1) {
        categoryRaw = categoryRaw.substring(0, parenIndex);
      }
      currentGroup = categoryRaw.trim();
      continue;
    }

    // Parse Channel Lines (e.g., 10 TV (720p) | https://...)
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|');
      let channelName = parts[0].trim();
      const streamUrl = parts[1].trim();

      // Ensure it's a valid URL before adding
      if (streamUrl.startsWith('http')) {
        m3uLines.push(`#EXTINF:-1 group-title="${currentGroup}",${channelName}`);
        m3uLines.push(streamUrl);
      }
    }
  }

  fs.writeFileSync(outputFile, m3uLines.join('\n'));
  console.log(`✅ Successfully converted to ${outputFile}`);
  console.log(`Total channels parsed: ${(m3uLines.length - 1) / 2}`);
}

// Run the converter
const args = process.argv.slice(2);
const inputFile = args[0] || 'raw_channels.txt';
const outputFile = args[1] || 'playlist_fixed.m3u';

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: Could not find input file: ${inputFile}`);
  console.log(`Please save your list of channels into a file named '${inputFile}' and run this script again.`);
  process.exit(1);
}

convertToM3U(inputFile, outputFile).catch(console.error);
