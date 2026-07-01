const express = require('express');
const app = express();

app.post('/channels/:id/hide', (req, res) => res.send('hide'));
app.post('/channels/:id/remove', (req, res) => res.send('remove'));
app.post('/channels/:id/restore', (req, res) => res.send('restore single'));
app.post('/channels/restore-all-hidden', (req, res) => res.send('restore all'));

const request = require('supertest');
request(app)
  .post('/channels/restore-all-hidden')
  .expect(200)
  .end((err, res) => {
    if (err) throw err;
    console.log('Result:', res.text);
  });
