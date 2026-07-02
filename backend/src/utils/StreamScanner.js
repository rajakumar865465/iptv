const { httpGet, resolveUrl, probeCodecs } = require('./streamDiagnoser');

/**
 * StreamScanner provides deep analysis of HLS streams to determine stability
 * and specific failure modes beyond simple HTTP status codes.
 */
class StreamScanner {
  /**
   * Performs a deep scan of an HLS stream.
   * @param {string} streamUrl The URL of the stream to scan.
   * @param {Object} headers Optional headers for the request.
   * @returns {Promise<Object>} Detailed scan results.
   */
  async deepScan(streamUrl, headers = {}) {
    const result = {
      master_m3u8_load_success: false,
      media_playlist_load_success: false,
      playlist_refresh_success: false,
      segment_load_success_1: false,
      segment_load_success_2: false,
      segment_load_success_3: false,
      segment_response_time: 0,
      segment_content_type: '',
      segment_size: 0,
      redirects_followed: 0,
      final_url: streamUrl,
      required_headers: headers,
      http_error_code: 0,
      token_expiry_detected: false,
      html_error_page_detected: false,
      geo_blocked: false,
      drm_protected: false,
      codec_issue_detected: false,
      scanner_status: 'unknown',
    };

    if (!streamUrl || !streamUrl.startsWith('http')) {
      result.scanner_status = 'offline';
      return result;
    }

    try {
      // 1. Test Master m3u8 load
      const startTime = Date.now();
      const masterRes = await httpGet(streamUrl, headers, false);
      const masterDuration = Date.now() - startTime;

      if (!masterRes.ok) {
        result.http_error_code = masterRes.status || 0;
        result.scanner_status = this._determineStatus(masterRes);
        return result;
      }

      result.master_m3u8_load_success = true;
      result.final_url = masterRes.finalUrl || streamUrl;

      // Detect HTML error pages (Geo-block/Captchas)
      if (masterRes.ct?.includes('text/html') || (masterRes.body && masterRes.body.includes('<html'))) {
        result.html_error_page_detected = true;
        result.geo_blocked = true;
        result.scanner_status = 'geo_blocked';
        return result;
      }

      // 2. Load Media Playlist (handle variant playlists)
      let mediaUrl = result.final_url;
      let mediaBody = masterRes.body || '';

      if (mediaBody.includes('#EXT-X-STREAM-INF')) {
        const variantUrl = this._extractBestVariant(mediaBody, result.final_url);
        if (variantUrl) {
          const variantRes = await httpGet(variantUrl, headers, false);
          if (variantRes.ok) {
            mediaUrl = variantUrl;
            mediaBody = variantRes.body || '';
          }
        }
      }

      const mediaRes = await httpGet(mediaUrl, headers, false);
      if (!mediaRes.ok) {
        result.http_error_code = mediaRes.status || 0;
        result.scanner_status = 'segment_failed';
        return result;
      }
      result.media_playlist_load_success = true;

      // 3. Test Playlist Refresh
      // Wait a small amount of time to see if the playlist updates (for live streams)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const refreshRes = await httpGet(mediaUrl, headers, false);
      if (refreshRes.ok) {
        result.playlist_refresh_success = true;
      }

      // 4. Test Segments (1, 2, 3)
      const segments = this._extractSegments(mediaBody, mediaUrl);
      if (segments.length === 0) {
        result.scanner_status = 'segment_failed';
        return result;
      }

      // Segment 1
      const seg1Start = Date.now();
      const seg1Res = await httpGet(segments[0], headers, true);
      const seg1Duration = Date.now() - seg1Start;
      if (seg1Res.ok) {
        result.segment_load_success_1 = true;
        result.segment_response_time = seg1Duration;
        result.segment_content_type = seg1Res.ct || '';
        result.segment_size = seg1Res.body ? seg1Res.body.length : 0;
      }

      // Segment 2
      const seg2Res = await httpGet(segments[1] || segments[0], headers, true);
      if (seg2Res.ok) {
        result.segment_load_success_2 = true;
      }

      // Segment 3 (Wait for target duration to test stability/expiry)
      // Normally HLS segments are 2-10s. We wait a bit.
      await new Promise(resolve => setTimeout(resolve, 5000));
      const seg3Res = await httpGet(segments[2] || segments[0], headers, true);
      if (seg3Res.ok) {
        result.segment_load_success_3 = true;
      } else if (result.segment_load_success_1 && !seg3Res.ok) {
        // If 1 worked but 3 failed after a wait, it might be a token expiry
        result.token_expiry_detected = true;
        result.scanner_status = 'expired_url';
      }

      // Final Status Determination
      if (result.segment_load_success_1 && result.segment_load_success_2 && result.segment_load_success_3) {
        result.scanner_status = 'working';
      } else if (result.segment_load_success_1) {
        result.scanner_status = 'unstable';
      } else {
        result.scanner_status = 'segment_failed';
      }

      // 5. Codec Check
      const probe = await probeCodecs(result.final_url, headers);
      if (probe.video_codec === 'mpeg2video') {
        result.codec_issue_detected = true;
        result.scanner_status = 'codec_unsupported_android';
      }

      return result;
    } catch (error) {
      result.scanner_status = 'unknown';
      result.http_error_code = 500;
      return result;
    }
  }

  _determineStatus(res) {
    if (res.status === 403 || res.status === 401) return 'forbidden';
    if (res.status === 404) return 'offline';
    if (res.status === 451) return 'geo_blocked';
    if (res.reason === 'timeout') return 'unstable';
    return 'offline';
  }

  _extractBestVariant(body, baseUrl) {
    const lines = body.split('\\n');
    let bestBw = -1;
    let bestUrl = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\\d+)/);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const next = lines[i + 1]?.trim();
        if (next && !next.startsWith('#')) {
          if (bw >= bestBw) {
            bestBw = bw;
            bestUrl = next;
          }
        }
      }
    }
    return bestUrl ? resolveUrl(baseUrl, bestUrl) : null;
  }

  _extractSegments(body, baseUrl) {
    const segments = [];
    const lines = body.split('\\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l.startsWith('#') && l) {
        segments.push(resolveUrl(baseUrl, l));
        if (segments.length >= 3) break;
      }
    }
    return segments;
  }
}

module.exports = new StreamScanner();
