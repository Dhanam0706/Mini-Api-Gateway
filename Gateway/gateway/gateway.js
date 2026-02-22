const fastify = require('fastify')({ logger: true });
const cors = require("@fastify/cors");
const fetch = global.fetch || require("node-fetch");
const { getCache, setCache } = require("./cache");
const circuitBreaker = require("./circuit-breaker");
const { tokenBucket, getBucketStatus } = require("./Ratelimit");
const client = require("./redis");
require("dotenv").config();
fastify.register(cors, { 
  origin: "*",
});
//PROMETHEUS
const promclient = require("prom-client");
const counter = new promclient.Counter({
  name: "http_requests_total",
  help: "Total requests"
});

const PORT = process.env.PORT || 3000;
const USER_SERVICE1 = process.env.USER_SERVICE1;
const USER_SERVICE2 = process.env.USER_SERVICE2;
const userServers = [USER_SERVICE1, USER_SERVICE2];
let userIndex = 0;

function getUserServer() {
  const server = userServers[userIndex];
  userIndex = (userIndex + 1) % userServers.length;
  return server;
}

const validApiKeys = ["student123", "dhanuKey", "adminKey"];

// --- HOOKS ---

// Hook 1: Metrics & Request ID (Runs for EVERY request)
// Combined Hook: Logging, Metrics, and Security
fastify.addHook("onRequest", (req, reply, done) => {
  // 1. Initial Setup & Metrics
  req.startTime = Date.now();
  req.id = Math.random().toString(36).substring(7);
  counter.inc(); // Increment your Prometheus/metrics counter

  // 2. Immediate Bypass for Preflight
  if (req.method === "OPTIONS") return done();

  // 3. Robust Public Path Check
  // We use .some() with .includes() to catch routes like /gateway/ratelimit/myKey
  const publicEndpoints = [
    "/metrics",
    "/gateway/status",
    "/gateway/ratelimit",
    "/gateway/circuit-status",
    "/api/users/update",
    "/api/orders/update",
    "/favicon.ico" // Prevents browser icon requests from hitting rate limits
  ];
  const isPublic = publicEndpoints.some(path => req.url.includes(path));

  if (isPublic) {
    return done(); 
  }

  // 4. API Key Validation
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return reply.code(401).send({ error: "API Key required" });
  }

  if (!validApiKeys.includes(apiKey)) {
    return reply.code(401).send({ error: "Invalid API Key" });
  }

  // 5. Rate Limiting Logic
  tokenBucket(apiKey)
    .then((result) => {
      // Set headers for every non-public request
      reply.header("X-RateLimit-Limit", 10);
      reply.header("X-RateLimit-Remaining", Math.floor(result.tokens));

      if (!result.allowed) {
        return reply.code(429).send({ 
          error: "Rate limit exceeded",
          retryAfter: 1 // Suggest 1 second retry
        });
      }
      done();
    })
    .catch((err) => {
      req.log.error(err);
      reply.code(500).send({ error: "Rate limiter internal error" });
    });
});

// Hook 3: Logging (Runs after response is sent)
fastify.addHook('onResponse', (req, reply, done) => {
  const latency = Date.now() - (req.startTime || Date.now());
  req.log.info(`[${req.id}] ${req.url} ${latency}ms`);
  done();
});

// --- HELPER ---
async function fetchWithTimeout(url, ms = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// --- GATEWAY ROUTES ---

fastify.get("/health", async () => {
  return { status: "Gateway OK", time: new Date() };
});

fastify.get("/metrics", async (req, reply) => {
  return promclient.register.metrics();
});

fastify.get("/gateway/status", async (request, reply) => {
  return {
    status: "healthy", // Helpful for automated health checks
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    // Convert memory from bytes to MB for better readability
    memory: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
    version: "1.0.0",
    node_version: process.version
  };
});

fastify.get("/gateway/ratelimit/:key", async (req) => {
  return await getBucketStatus(req.params.key);
});

fastify.get("/gateway/circuit-status", async () => ({
  userService: circuitBreaker.userService,
  orderService: circuitBreaker.orderService
}));

// --- PROXIED API ROUTES ---

fastify.get("/api/users", async (req, reply) => {
  const breaker = circuitBreaker.userService;
  const apiKey = req.headers["x-api-key"];
  const cacheKey = `users_${apiKey}`;

  // 1. Circuit Breaker Logic
  if (breaker.open) {
    if (Date.now() - breaker.lastFailureTime > 10000) {
      breaker.open = false;
      breaker.failures = 0;
    } else {
      return reply.send({ message: "User service down", fallbackUsers: ["Guest"] });
    }
  }

  // 2. Cache Logic
  const cached = await getCache(cacheKey);
  if (cached) return reply.send({ data: cached, source: "CACHE" });

  try {
    const url = getUserServer();
    const res = await fetchWithTimeout(url);
    
    // Check if the response is actually successful
    if (!res.ok) {
        // Log error but DONT increment failures for Rate Limits
        if (res.status === 429) {
            return reply.code(429).send({ error: "Rate limit exceeded" });
        }
        throw new Error(`Service responded with ${res.status}`);
    }

    const data = await res.json();
    breaker.failures = 0; // ✅ Success: Clear failures
    await setCache(cacheKey, data);
    return reply.send({ data, source: "SERVICE", serverUsed: url });

  } catch (err) {
    // 🛑 THE FIX: Increment failures only for real network/server errors
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    if (breaker.failures >= 3) breaker.open = true;
    
    return reply.status(500).send({ message: "User service crashed", fallbackUsers: ["Guest"] });
  }
});

fastify.get("/api/orders", async (req, reply) => {
  const breaker = circuitBreaker.orderService;
  const apiKey = req.headers["x-api-key"];
  const cacheKey = `orders_${apiKey}`;

  if (breaker.open) {
    if (Date.now() - breaker.lastFailureTime > 10000) {
      breaker.open = false;
      breaker.failures = 0;
    } else {
      return reply.send({ message: "Order service down", fallbackUsers: ["Guest"] });
    }
  }

  const cached = await getCache(cacheKey);
  if (cached) return reply.send({ data: cached, source: "CACHE" });

  try {
    const url = process.env.ORDER_SERVICE;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
        if (res.status === 429) {
            return reply.code(429).send({ error: "Rate limit exceeded" });
        }
        throw new Error(`Service responded with ${res.status}`);
    }

    const data = await res.json();
    breaker.failures = 0; // ✅ Success: Clear failures
    await setCache(cacheKey, data);
    return reply.send({ data, source: "SERVICE", serverUsed: url });

  } catch (err) {
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    if (breaker.failures >= 3) breaker.open = true;
    
    return reply.status(500).send({ message: "Order service crashed", fallbackUsers: ["Guest"] });
  }
});

// --- CACHE MANAGEMENT ---
fastify.post("/api/users/update", async () => {
  const keys = await client.keys("users_*");
  if (keys.length > 0) await client.del(keys);
  return { msg: "All users cache cleared" };
});

fastify.post("/api/orders/update", async () => {
  const keys = await client.keys("orders_*");
  if (keys.length > 0) await client.del(keys);
  return { msg: "All orders cache cleared" };
});

// --- ERROR HANDLER ---
fastify.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  reply.code(err.statusCode || 500).send({
    message: err.message || "Gateway Error",
    requestId: req.id
  });
});

// --- START SERVER ---
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Gateway server listening on port ${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down gateway...");
  await client.quit();
  process.exit(0);
});