const { safeFetch } = require('./src/utils/ssrfGuard');
async function test() {
  try {
    const res = await safeFetch('https://iptv-org.github.io/iptv/languages/hin.m3u');
    console.log('Status:', res.status);
    console.log('Headers:', res.headers.raw());
    const text = await res.text();
    console.log('Content length:', text.length);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
