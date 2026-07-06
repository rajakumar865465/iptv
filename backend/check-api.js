const http = require('http');
http.get('http://35.154.128.217/api/channels?workingOnly=true&limit=5', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data.substring(0, 500));
  });
});
