const http = require('http');
http.get('http://35.154.128.217/api/channels', res => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data.substring(0, 200)));
}).on('error', console.error);
