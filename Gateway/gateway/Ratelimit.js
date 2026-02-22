const client = require("./redis");
const MAX_TOKENS = 10;
const REFILL_RATE = 5;

async function tokenBucket(apiKey) {
  const key = `bucket:${apiKey}`;
  const now = Date.now();

  const data = await client.hGetAll(key);
  
  // If no data, start with MAX_TOKENS
  let last = data.last ? parseInt(data.last) : now;
  let tokens = data.tokens ? parseFloat(data.tokens) : MAX_TOKENS;

  // Calculate "Live" tokens based on time passed
  const elapsed = (now - last) / 1000;
  let refreshedTokens = Math.min(MAX_TOKENS, tokens + (elapsed * REFILL_RATE));

  if (refreshedTokens < 1) {
    return { allowed: false, tokens: refreshedTokens };
  }

  // Spend 1 token
  refreshedTokens -= 1;

  // Save to Redis
  await client.hSet(key, { 
    tokens: refreshedTokens.toFixed(2), 
    last: now 
  });

  return { allowed: true, tokens: refreshedTokens };
}

async function getBucketStatus(apiKey) {
  const key = `bucket:${apiKey}`;
  const now = Date.now();
  const data = await client.hGetAll(key);

  if (!data.last) return { tokens: MAX_TOKENS };

  // CRITICAL FIX: Calculate the refill in the status check too!
  // Otherwise, the UI stays "stale" until you make a new request.
  const last = parseInt(data.last);
  const tokens = parseFloat(data.tokens);
  const elapsed = (now - last) / 1000;
  
  const liveTokens = Math.min(MAX_TOKENS, tokens + (elapsed * REFILL_RATE));
  
  return { tokens: liveTokens };
}

module.exports = { tokenBucket, getBucketStatus };