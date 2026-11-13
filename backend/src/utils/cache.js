const cache = new Map();

exports.get = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
};

exports.set = (key, value, ttlSeconds = 60) => {
  cache.set(key, {
    value,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
};

exports.del = (key) => cache.delete(key);

exports.delByPrefix = (prefix) => {
  for (const key of cache.keys()) {
    if (String(key).startsWith(prefix)) {
      cache.delete(key);
    }
  }
};

exports.invalidateChannelCaches = () => {
  exports.delByPrefix('channels_');
  exports.delByPrefix('playback_');
  exports.del('home_common_data');
};

exports.invalidatePlaybackCache = (userId = null) => {
  if (!userId) {
    exports.delByPrefix('playback_');
    return;
  }
  const suffix = `_${userId}`;
  for (const key of cache.keys()) {
    if (String(key).startsWith('playback_') && String(key).endsWith(suffix)) {
      cache.delete(key);
    }
  }
};

exports.flush = () => cache.clear();
