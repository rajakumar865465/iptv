/**
 * Script to download an APK from Google Drive (handling virus scan confirmation)
 * and save it locally to backend/public/downloads/app-release.apk so that
 * users get an instant direct 1-click download from your website.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE_ID = process.argv[2] || '1M82Xrr9eAvxb7rTxt_phC5Tc18oQYW0q';
const TARGET_PATH = path.join(__dirname, '..', 'public', 'downloads', 'app-release.apk');

console.log(`[APK Sync] Downloading Google Drive file ID: ${FILE_ID}`);
console.log(`[APK Sync] Target destination: ${TARGET_PATH}`);

// Ensure target directory exists
const targetDir = path.dirname(TARGET_PATH);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function fetchUrl(url, cookies = '', redirectCount = 0) {
  if (redirectCount > 10) {
    throw new Error('Too many redirects');
  }

  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(cookies ? { Cookie: cookies } : {})
      }
    };

    client.get(url, options, (res) => {
      // Capture set-cookie headers
      const setCookies = res.headers['set-cookie'] || [];
      const newCookieStr = setCookies.map(c => c.split(';')[0]).join('; ');
      const combinedCookies = [cookies, newCookieStr].filter(Boolean).join('; ');

      // Handle HTTP redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        return resolve(fetchUrl(redirectUrl, combinedCookies, redirectCount + 1));
      }

      // Check if it's the HTML confirmation page
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let htmlBody = '';
        res.on('data', chunk => { htmlBody += chunk; });
        res.on('end', () => {
          // Look for confirm token or direct download link in HTML
          const confirmMatch = htmlBody.match(/confirm=([0-9A-Za-z_]+)/) ||
                               htmlBody.match(/id="download-form" action="([^"]+)"/) ||
                               htmlBody.match(/href="(\/uc\?export=download[^"]+)"/);
          
          if (confirmMatch) {
            let nextUrl = confirmMatch[1];
            if (!nextUrl.startsWith('http')) {
              if (nextUrl.startsWith('/')) {
                nextUrl = `https://drive.google.com${nextUrl}`;
              } else {
                nextUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${FILE_ID}`;
              }
            }
            return resolve(fetchUrl(nextUrl, combinedCookies, redirectCount + 1));
          } else {
            // Try usercontent direct stream
            const directUrl = `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download&authuser=0&confirm=t`;
            return resolve(fetchUrl(directUrl, combinedCookies, redirectCount + 1));
          }
        });
        return;
      }

      // We have the binary file stream!
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      const fileStream = fs.createWriteStream(TARGET_PATH);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\r[APK Sync] Downloading: ${pct}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)}MB / ${(totalBytes / (1024 * 1024)).toFixed(1)}MB)`);
        } else {
          process.stdout.write(`\r[APK Sync] Downloading: ${(downloadedBytes / (1024 * 1024)).toFixed(1)}MB`);
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`\n[APK Sync] Successfully downloaded and saved to: ${TARGET_PATH}`);
        console.log(`[APK Sync] File size: ${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB`);
        resolve(TARGET_PATH);
      });

      fileStream.on('error', (err) => {
        fs.unlink(TARGET_PATH, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

const initialUrl = `https://drive.google.com/uc?export=download&id=${FILE_ID}`;
fetchUrl(initialUrl)
  .then(() => {
    console.log('[APK Sync] Done! Public URL: /downloads/app-release.apk');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[APK Sync] Error:', err.message);
    process.exit(1);
  });
