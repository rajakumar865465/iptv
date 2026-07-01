const fs = require('fs');

const content = fs.readFileSync('channels_to_add.txt', 'utf8');
const lines = content.split('\n');

const categoryMap = {
    'entertainment': 652,
    'news': 647,
    'business': 643,
    'sports': 628,
    'music': 629,
    'kids': 630,
    'movies': 649,
    'documentary': 654,
    'dd': 622,
    'regional - tamil': 633,
    'regional - telugu': 634,
    'regional - malayalam': 635,
    'regional - kannada': 636,
    'english': 656
};

let currentCategoryId = 645; // Default: General

const channels = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('--- ') && line.endsWith(' ---')) {
        let cat = line.replace(/---/g, '').trim().toLowerCase();
        currentCategoryId = categoryMap[cat] || 645;
    } else if (line.match(/^\[(OK|FAIL|WARN)\]/)) {
        const match = line.match(/^\[.*?\]\s+(.*)$/);
        if (match) {
            const name = match[1].trim();
            if (i + 1 < lines.length && lines[i+1].trim().startsWith('URL:')) {
                const urlMatch = lines[i+1].match(/URL:\s*(.*)$/);
                if (urlMatch) {
                    let status = 'active';
                    const url = urlMatch[1].trim();
                    channels.push({
                        name: name.replace(/'/g, "''"),
                        url: url.replace(/'/g, "''"),
                        category_id: currentCategoryId,
                        status: status
                    });
                }
            }
        }
    }
}

let sql = `TRUNCATE TABLE channels CASCADE;
ALTER SEQUENCE channels_id_seq RESTART WITH 1;
INSERT INTO channels (name, stream_url, category_id, language, country, status) VALUES\n`;

const values = channels.map(c => `('${c.name}', '${c.url}', ${c.category_id}, 'Hindi', 'IN', '${c.status}')`);
sql += values.join(',\n') + ';\n';

fs.writeFileSync('insert_channels.sql', sql);
console.log(`Generated insert_channels.sql with ${channels.length} channels.`);
