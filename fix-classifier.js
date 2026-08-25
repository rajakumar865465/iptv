const fs = require('fs');
let content = fs.readFileSync('backend/scripts/lib/channel-classifier.js', 'utf8');

content = content.replace(
  /'Doordarshan', 'Entertainment', 'Movies', 'News', 'Sports', 'Music',/,
  "'Doordarshan', 'Entertainment', 'Movies', 'News', 'Sports', 'Music', 'Documentary',"
);

content = content.replace(
  /'hindi entertainment': null, \/\/ too unreliable[^\n]*\n/,
  "'hindi entertainment': 'Entertainment', 'documentary': 'Documentary', 'religious': 'Devotional', 'international': 'General',\n"
);

fs.writeFileSync('backend/scripts/lib/channel-classifier.js', content);
