'use strict';
/**
 * m3uParser.js
 * Parses raw M3U text into normalized channel entries, ready for duplicate
 * detection and stream health scanning. Never trusts the source to provide
 * complete/clean metadata — everything is normalized here.
 */

const parser = require('iptv-playlist-parser');

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
 * @param {string} content raw M3U text
 * @param {object} defaults optional fallback metadata, e.g. { language: 'Hindi', country: 'IN', source: 'iptv-org' }
 * @returns {Array<object>} normalized channel entries
 */
function parseM3u(content, defaults = {}) {
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error('M3U content is empty');
  }
  if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
    throw new Error('Content does not look like a valid M3U playlist');
  }

  const playlist = parser.parse(content);
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

module.exports = { parseM3u, normalizeUrl, normalizeName };
