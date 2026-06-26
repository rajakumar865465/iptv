const https = require('https');
const checkUrl = (url) => {
  https.get(url, (res) => {
    console.log(`[${res.statusCode}] ${url}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(data.substring(0, 200));
    });
  }).on('error', console.error);
};
checkUrl('https://iptv-6vbq.onrender.com/api/channels/categories?workingOnly=true');
checkUrl('https://iptv-6vbq.onrender.com/api/channels/languages?workingOnly=true');
