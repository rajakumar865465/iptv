const https = require('https');
const http = require('http');
const { URL } = require('url');
const { execFile, spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const UA_DEFAULT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function resolveUrl(base, rel) {
  if (!rel) return null;
  if (rel.startsWith('http')) return rel;
  try { return new URL(rel, base).href; } catch { return null; }
}

function httpGet(url, headers = {}, segmentMode = false, timeout = 10000, redirectDepth = 0) {
  return new Promise(resolve => {
    if (redirectDepth > 5) {
      return resolve({ ok: false, reason: 'too_many_redirects', finalUrl: url });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ ok: false, reason: 'invalid_url', finalUrl: url });
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const reqHeaders = {
      'User-Agent': headers['User-Agent'] || headers['user-agent'] || UA_DEFAULT,
      ...(headers['Referer'] || headers['referer'] ? { 'Referer': headers['Referer'] || headers['referer'] } : {}),
      ...(headers['Origin'] || headers['origin'] ? { 'Origin': headers['Origin'] || headers['origin'] } : {}),
      ...(segmentMode ? { 'Range': 'bytes=0-8191' } : {}),
    };

    for (const [k, v] of Object.entries(headers)) {
      const lowerK = k.toLowerCase();
      if (lowerK !== 'user-agent' && lowerK !== 'referer' && lowerK !== 'origin' && v) {
        reqHeaders[k] = v;
      }
    }

    const reqOpts = {
      method: 'GET',
      timeout,
      headers: reqHeaders,
      // VLC/App compatibility: ignore SSL verification errors
      ...(parsed.protocol === 'https:' ? { rejectUnauthorized: false } : {})
    };

    let isResolved = false;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        if (req) req.destroy();
        resolve({ ok: false, reason: 'hard_timeout', finalUrl: url });
      }
    }, timeout + 2000); // hard timeout slightly longer than socket timeout

    const req = client.request(url, reqOpts, res => {
      const status = res.statusCode;

      if (status >= 300 && status < 400 && res.headers.location) {
        isResolved = true;
        clearTimeout(timer);
        req.destroy(); // abort current connection
        const nextUrl = resolveUrl(url, res.headers.location);
        return resolve(httpGet(nextUrl, headers, segmentMode, timeout, redirectDepth + 1));
      }

      const ct = (res.headers['content-type'] || '').toLowerCase();
      let body = '';
      const enc = segmentMode ? 'binary' : 'utf8';
      res.setEncoding(enc);
      
      const chunks = [];
      res.on('data', chunk => {
        if (segmentMode) {
          chunks.push(Buffer.from(chunk, 'binary'));
          const totalBytes = chunks.reduce((acc, c) => acc + c.length, 0);
          if (totalBytes > 8192) {
            // Resolve BEFORE destroying — server may ignore Range and send full file (200).
            // res.destroy() fires 'close' not 'end', so resolve here to avoid ok:false.
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timer);
              resolve({
                ok: status >= 200 && status < 300 || status === 206,
                status, ct, body: Buffer.concat(chunks), finalUrl: url
              });
            }
            res.destroy();
          }
        } else {
          body += chunk;
          if (body.length > 300000) {
            res.destroy();
          }
        }
      });

      res.on('end', () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timer);

        if (segmentMode) {
          const fullBuf = Buffer.concat(chunks);
          resolve({
            ok: status >= 200 && status < 300 || status === 206,
            status,
            ct,
            body: fullBuf,
            finalUrl: url
          });
        } else {
          resolve({
            ok: status >= 200 && status < 300,
            status,
            ct,
            body,
            finalUrl: url
          });
        }
      });

      res.on('error', e => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({ ok: false, reason: 'res_error', msg: e.message, finalUrl: url });
        }
      });

      res.on('close', () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({ ok: false, reason: 'premature_close', finalUrl: url });
        }
      });
    });

    req.on('error', e => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'req_error', msg: e.message, finalUrl: url });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'timeout', finalUrl: url });
      }
    });

    req.end();
  });
}

function probeCodecs(url, headers = {}) {
  return new Promise((resolve) => {
    if (!ffmpegPath) {
      return resolve({ video_codec: null, audio_codec: null, error: 'ffmpeg_static_missing' });
    }

    let headersStr = '';
    for (const [k, v] of Object.entries(headers)) {
      if (v) headersStr += `${k}: ${v}\r\n`;
    }

    const args = [
      '-analyzeduration', '200000',
      '-probesize', '65536',
    ];
    if (headersStr) {
      args.push('-headers', headersStr);
    }
    args.push('-i', url, '-f', 'null', '-');

    const child = spawn(ffmpegPath, args);
    let output = '';
    let resolved = false;

    const cleanupAndResolve = (result) => {
      if (resolved) return;
      resolved = true;
      try { child.kill(); } catch (_) {}
      resolve(result);
    };

    child.stderr.on('data', (data) => {
      output += data.toString();
      
      const videoMatch = output.match(/Stream #\d:\d.*Video: ([a-zA-Z0-9_]+)/i);
      const audioMatch = output.match(/Stream #\d:\d.*Audio: ([a-zA-Z0-9_]+)/i);
      const resMatch = output.match(/(\d{3,4})x(\d{3,4})/);
      
      if (videoMatch && audioMatch) {
        cleanupAndResolve({
          video_codec: videoMatch[1].toLowerCase(),
          audio_codec: audioMatch[1].toLowerCase(),
          width: resMatch ? parseInt(resMatch[1], 10) : null,
          height: resMatch ? parseInt(resMatch[2], 10) : null,
        });
      }
    });

    child.on('close', () => {
      const videoMatch = output.match(/Stream #\d:\d.*Video: ([a-zA-Z0-9_]+)/i);
      const audioMatch = output.match(/Stream #\d:\d.*Audio: ([a-zA-Z0-9_]+)/i);
      const resMatch = output.match(/(\d{3,4})x(\d{3,4})/);
      
      cleanupAndResolve({
        video_codec: videoMatch ? videoMatch[1].toLowerCase() : null,
        audio_codec: audioMatch ? audioMatch[1].toLowerCase() : null,
        width: resMatch ? parseInt(resMatch[1], 10) : null,
        height: resMatch ? parseInt(resMatch[2], 10) : null,
      });
    });

    // Safety timeout (15 seconds)
    setTimeout(() => {
      const videoMatch = output.match(/Stream #\d:\d.*Video: ([a-zA-Z0-9_]+)/i);
      const audioMatch = output.match(/Stream #\d:\d.*Audio: ([a-zA-Z0-9_]+)/i);
      const resMatch = output.match(/(\d{3,4})x(\d{3,4})/);
      
      cleanupAndResolve({
        video_codec: videoMatch ? videoMatch[1].toLowerCase() : null,
        audio_codec: audioMatch ? audioMatch[1].toLowerCase() : null,
        width: resMatch ? parseInt(resMatch[1], 10) : null,
        height: resMatch ? parseInt(resMatch[2], 10) : null,
      });
    }, 15000);
  });
}

async function diagnoseStream(streamUrl, inputHeaders = {}) {
  const result = {
    manifest_ok: false,
    segment_ok: false,
    requires_headers: false,
    final_url: streamUrl,
    content_type: '',
    video_codec: null,
    audio_codec: null,
    width: null,
    height: null,
    container_type: 'hls',
    segment_type: 'ts',
    android_playable: true,
    vlc_playable: true,
    health_status: 'online',
    health_reason: 'stable',
    headers_detected: {}
  };

  if (!streamUrl || !streamUrl.startsWith('http')) {
    result.health_status = 'offline';
    result.health_reason = 'invalid_url';
    result.android_playable = false;
    result.vlc_playable = false;
    return result;
  }

  // 1. Try fetching with clean headers (no custom agent) to see if it requires headers
  const testHeaders = { ...inputHeaders };
  const cleanRes = await httpGet(streamUrl, {}, false, 8000);
  
  let useHeaders = { ...testHeaders };
  if (!cleanRes.ok && (cleanRes.status === 403 || cleanRes.status === 401 || cleanRes.reason === 'timeout')) {
    // If failed, try with browser-like headers
    result.requires_headers = true;
    if (!testHeaders['User-Agent'] && !testHeaders['user-agent']) {
      useHeaders['User-Agent'] = UA_DEFAULT;
    }
  }
  result.headers_detected = useHeaders;

  // 2. Fetch manifest
  const manifestRes = await httpGet(streamUrl, useHeaders, false, 10000);
  result.final_url = manifestRes.finalUrl || streamUrl;
  result.content_type = manifestRes.ct || '';

  if (!manifestRes.ok) {
    result.health_status = 'offline';
    result.android_playable = false;
    result.vlc_playable = false;
    
    if (manifestRes.status === 403 || manifestRes.status === 401) result.health_reason = 'forbidden_403';
    else if (manifestRes.status === 404) result.health_reason = 'not_found_404';
    else if (manifestRes.status === 451) result.health_reason = 'geo_blocked';
    else if (manifestRes.reason === 'timeout') result.health_reason = 'timeout';
    else result.health_reason = `http_${manifestRes.status || manifestRes.reason || 'error'}${manifestRes.msg ? ': ' + manifestRes.msg : ''}`;
    
    return result;
  }

  const body = (manifestRes.body || '').trim();
  if (body.startsWith('<') || body.includes('<html')) {
    result.health_status = 'offline';
    result.health_reason = 'geo_blocked_html';
    result.android_playable = false;
    result.vlc_playable = false;
    return result;
  }

  if (!body.startsWith('#EXTM3U')) {
    result.health_status = 'offline';
    result.health_reason = 'not_hls';
    result.android_playable = false;
    result.vlc_playable = false;
    return result;
  }

  result.manifest_ok = true;

  let mediaUrl = result.final_url;
  let mediaBody = body;

  // Parse variant master playlist
  if (body.includes('#EXT-X-STREAM-INF')) {
    const lines = body.split('\n');
    let bestBw = -1, bestVariantUrl = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const next = lines[i + 1]?.trim();
        if (next && !next.startsWith('#')) {
          const variantUrl = resolveUrl(mediaUrl, next);
          if (variantUrl && bw >= bestBw) {
            bestBw = bw;
            bestVariantUrl = variantUrl;
          }
        }
      }
    }
    if (bestVariantUrl) {
      const variantRes = await httpGet(bestVariantUrl, useHeaders, false, 8000);
      if (variantRes.ok) {
        mediaUrl = bestVariantUrl;
        mediaBody = variantRes.body || '';
      }
    }
  }

  // Find first segment URL
  let segRelUrl = null;
  const lines = mediaBody.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('#EXTINF') && lines[i + 1]) {
      const next = lines[i + 1].trim();
      if (next && !next.startsWith('#')) { segRelUrl = next; break; }
    }
  }
  if (!segRelUrl) {
    for (const l of lines) {
      const t = l.trim();
      if (t && !t.startsWith('#') && (t.endsWith('.ts') || t.endsWith('.mp4') || t.endsWith('.aac') || t.startsWith('http') || t.includes('segment'))) {
        segRelUrl = t; break;
      }
    }
  }

  if (!segRelUrl) {
    result.health_status = 'unstable';
    result.health_reason = 'no_segment_found';
    return result;
  }

  // Fetch first segment
  const segUrl = resolveUrl(mediaUrl, segRelUrl);
  if (!segUrl) {
    result.health_status = 'unstable';
    result.health_reason = 'invalid_segment_url';
    return result;
  }

  if (segUrl.endsWith('.mp4') || segUrl.includes('.m4s')) {
    result.segment_type = 'fmp4';
  }

  const segRes = await httpGet(segUrl, useHeaders, true, 8000);
  if (!segRes.ok) {
    result.health_status = 'unstable';
    result.health_reason = `segment_fetch_failed_${segRes.status || segRes.reason}`;
    return result;
  }

  result.segment_ok = true;

  // 3. Codec probing with ffmpeg
  const probe = await probeCodecs(result.final_url, useHeaders);
  result.video_codec = probe.video_codec;
  result.audio_codec = probe.audio_codec;
  result.width = probe.width;
  result.height = probe.height;

  // Determine playability
  if (probe.video_codec === 'mpeg2video') {
    result.android_playable = false;
    result.health_reason = 'codec_unsupported_android';
    result.health_status = 'unstable'; // VLC plays it, so it's not offline!
  } else if (!probe.video_codec && !probe.audio_codec) {
    // If ffmpeg fails to probe but HLS segments download fine, assume generic playability
    result.android_playable = true;
    result.vlc_playable = true;
  }

  return result;
}

module.exports = {
  diagnoseStream,
  httpGet,
  resolveUrl,
  probeCodecs
};
