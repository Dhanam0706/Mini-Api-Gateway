const client = require("./redis");

async function getCache(key) {
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

async function setCache(key, value, ttl = 30) {
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
  } catch (err) { console.error("Cache Error:", err); }
}

module.exports = { getCache, setCache };