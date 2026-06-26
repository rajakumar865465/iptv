const https = require('https');
https.get('https://iptv-6vbq.onrender.com/api/channels?workingOnly=true&limit=5', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data.substring(0, 500));
  });
});
