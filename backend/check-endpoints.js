const http = require('http');
const checkUrl = (url) => {
  http.get(url, (res) => {
    console.log(`[${res.statusCode}] ${url}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(data.substring(0, 200));
    });
  }).on('error', console.error);
};
checkUrl('http://35.154.128.217/api/channels/categories?workingOnly=true');
checkUrl('http://35.154.128.217/api/channels/languages?workingOnly=true');
