'use strict';
/**
 * m3uParser.js
 * Parses raw M3U text into normalized channel entries, ready for duplicate
 * detection and stream health scanning. Never trusts the source to provide
 * complete/clean metadata — everything is normalized here.
 */

const parser = require('iptv-playlist-parser');

const LANGUAGE_CODE_MAP = {
  hin: 'Hindi',
  bho: 'Bhojpuri',
  tam: 'Tamil',
  tel: 'Telugu',
  urd: 'Urdu',
  ory: 'Odia',
  ben: 'Bengali',
  mal: 'Malayalam',
  kan: 'Kannada',
  mar: 'Marathi',
  guj: 'Gujarati',
  pan: 'Punjabi',
  asm: 'Assamese',
  eng: 'English',
  nep: 'Nepali',
  san: 'Sanskrit',
  ara: 'Arabic',
  spa: 'Spanish',
  fra: 'French',
  deu: 'German',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  zho: 'Chinese',
  jpn: 'Japanese',
  kor: 'Korean'
};

function detectLanguageFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/([a-z]{3})\.m3u/i) || url.match(/\/languages\/([a-z]{2,3})\b/i);
  if (match) {
    const code = match[1].toLowerCase();
    return LANGUAGE_CODE_MAP[code] || null;
  }
  return null;
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url.trim());
    u.hash = '';
    const pathname = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.hostname.toLowerCase()}${pathname}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @param {string} content raw M3U text or stream lines
 * @param {object} defaults optional fallback metadata, e.g. { language: 'Hindi', country: 'IN', source: 'iptv-org' }
 * @returns {Array<object>} normalized channel entries
 */
function parseM3u(content, defaults = {}) {
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error('M3U content is empty');
  }

  const cleanContent = content.replace(/^\uFEFF/, '').trim();

  // 1. Standard M3U playlist with #EXTM3U or #EXTINF
  if (cleanContent.includes('#EXTM3U') || cleanContent.includes('#EXTINF')) {
    const playlist = parser.parse(cleanContent);
    const items = [];

    for (const item of playlist.items || []) {
      const name = (item.name || '').trim();
      const url = (item.url || '').trim();
      if (!name || !url) continue;

      items.push({
        channel_name: name,
        name_normalized: normalizeName(name),
        stream_url: url,
        stream_url_normalized: normalizeUrl(url),
        tvg_id: item.tvg?.id || '',
        tvg_name: item.tvg?.name || name,
        tvg_logo: item.tvg?.logo || '',
        group_title: item.group?.title || '',
        language: defaults.language || item.tvg?.language || '',
        country: defaults.country || item.tvg?.country || '',
        source: defaults.source || 'm3u-import',
        user_agent: item.http?.['user-agent'] || item.http?.user_agent || null,
        referer: item.http?.referrer || null,
      });
    }

    return items;
  }

  // 2. Fallback: Parse plain stream URL lines (e.g. "Name, https://..." or "https://...")
  const lines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const urlMatch = line.match(/(https?:\/\/[^\s,]+)/i);
    if (urlMatch) {
      const url = urlMatch[1];
      let name = line.replace(url, '').replace(/^[,:\s-]+|[,:\s-]+$/g, '').trim();
      if (!name) {
        try {
          const u = new URL(url);
          const parts = u.pathname.split('/').filter(Boolean);
          const lastPart = parts.pop() || 'Channel';
          name = decodeURIComponent(lastPart).replace(/\.(m3u8?|mpd|ts)$/i, '').replace(/[-_]+/g, ' ');
          if (!name || name.length < 2) name = `Channel ${i + 1}`;
        } catch {
          name = `Channel ${i + 1}`;
        }
      }

      items.push({
        channel_name: name,
        name_normalized: normalizeName(name),
        stream_url: url,
        stream_url_normalized: normalizeUrl(url),
        tvg_id: '',
        tvg_name: name,
        tvg_logo: '',
        group_title: defaults.group_title || '',
        language: defaults.language || '',
        country: defaults.country || '',
        source: defaults.source || 'url-import',
        user_agent: null,
        referer: null,
      });
    }
  }

  if (!items.length) {
    throw new Error('Content does not look like a valid M3U playlist or list of stream URLs');
  }

  return items;
}

module.exports = { parseM3u, normalizeUrl, normalizeName, detectLanguageFromUrl, LANGUAGE_CODE_MAP };
