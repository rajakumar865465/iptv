import sys
import re
import urllib.request
import http.cookiejar

file_id = sys.argv[1] if len(sys.argv) > 1 else '1M82Xrr9eAvxb7rTxt_phC5Tc18oQYW0q'
output_path = sys.argv[2] if len(sys.argv) > 2 else 'public/downloads/app-release.apk'

cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
urllib.request.install_opener(opener)

url = f'https://drive.google.com/uc?export=download&id={file_id}'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

response = opener.open(req)
content = response.read()

# Check for confirmation token
confirm_token = None
for cookie in cookie_jar:
    if cookie.name.startswith('download_warning'):
        confirm_token = cookie.value
        break

if not confirm_token:
    match = re.search(r'confirm=([0-9A-Za-z_]+)', content.decode('utf-8', errors='ignore'))
    if match:
        confirm_token = match.group(1)

if confirm_token:
    download_url = f'https://drive.google.com/uc?export=download&confirm={confirm_token}&id={file_id}'
    print(f"Found confirm token: {confirm_token}, downloading from {download_url}...")
    req2 = urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with opener.open(req2) as resp2, open(output_path, 'wb') as f:
        f.write(resp2.read())
else:
    # Check if download form exists in HTML
    form_match = re.search(r'action="([^"]+)"', content.decode('utf-8', errors='ignore'))
    if b'PK\x03\x04' in content[:10] or b'dex' in content[:10]: # Valid zip/apk binary
        with open(output_path, 'wb') as f:
            f.write(content)
        print("Downloaded binary directly!")
    elif form_match:
        action_url = form_match.group(1)
        if not action_url.startswith('http'):
            action_url = 'https://drive.google.com' + action_url
        print(f"Submitting download form to: {action_url}")
        req3 = urllib.request.Request(action_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with opener.open(req3) as resp3, open(output_path, 'wb') as f:
            f.write(resp3.read())

import os
if os.path.exists(output_path):
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Download complete: {output_path} ({size_mb:.2f} MB)")
