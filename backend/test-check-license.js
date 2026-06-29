const http = require('http');

const data = JSON.stringify({
  license_key: '035081-BE993B-A53DB5-4E095B'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/public/license/check',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let body = '';
  res.on('data', d => {
    body += d;
  });
  res.on('end', () => {
    console.log(body);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
