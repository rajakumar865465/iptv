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
exports.flush = () => cache.clear();
