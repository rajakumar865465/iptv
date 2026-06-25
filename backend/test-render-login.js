const http = require('https');

const data = JSON.stringify({
  email: 'demo12@gmail.com',
  password: 'password',
  device_id: 'test-device-id-12345',
  device_name: 'Android Emulator',
  app_version: '1.0.0'
});

const options = {
  hostname: 'iptv-6vbq.onrender.com',
  port: 443,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Response Body:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
