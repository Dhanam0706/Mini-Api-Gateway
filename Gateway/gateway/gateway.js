require("dotenv").config();
const crypto = require('crypto');
const fastify = require('fastify')({ logger: true });
const cors = require("@fastify/cors");
const fetch = global.fetch || require("node-fetch");
const { getCache, setCache } = require("./cache");
const circuitBreaker = require("./circuit-breaker");
const { tokenBucket, getBucketStatus } = require("./Ratelimit");
const client = require("./redis");

fastify.register(cors, { origin: "*" });

const activeKeys = new Map(); 

// PROMETHEUS
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

// --- HOOKS ---
fastify.addHook("onRequest", (req, reply, done) => {
  req.startTime = Date.now();
  req.id = Math.random().toString(36).substring(7);
  counter.inc();

  if (req.method === "OPTIONS") return done();

  // Robust check for public paths
  const publicEndpoints = [
    "/auth/login", 
    "/metrics",
    "/gateway/status",
    "/gateway/ratelimit",
    "/gateway/circuit-status",
    "/api/users/update",
    "/api/orders/update"
  ];
  
  const isPublic = publicEndpoints.some(path => req.url.startsWith(path));
  if (isPublic) return done();

  const apiKey = req.headers["x-api-key"];
  if (!apiKey || !activeKeys.has(apiKey)) {
    return reply.code(401).send({ error: "Invalid or expired API Key. Please login." });
  }

  tokenBucket(apiKey)
    .then((result) => {
      reply.header("X-RateLimit-Limit", 10);
      reply.header("X-RateLimit-Remaining", Math.floor(result.tokens));
      if (!result.allowed) {
        return reply.code(429).send({ error: "Rate limit exceeded", retryAfter: 1 });
      }
      done();
    })
    .catch((err) => {
      req.log.error(err);
      reply.code(500).send({ error: "Rate limiter internal error" });
    });
});

// --- ROUTES ---

fastify.post("/auth/login", async (req, reply) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "1234") {
    const newKey = crypto.randomBytes(16).toString('hex');
    activeKeys.set(newKey, username);
    return { success: true, apiKey: newKey, message: "Login successful" };
  }
  return reply.code(401).send({ success: false, message: "Invalid credentials" });
});

fastify.get("/gateway/status", async () => ({
  status: "healthy",
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
}));

fastify.get("/gateway/ratelimit/:key", async (req) => {
  return await getBucketStatus(req.params.key);
});

fastify.get("/gateway/circuit-status", async () => ({
  userService: circuitBreaker.userService,
  orderService: circuitBreaker.orderService
}));

fastify.get("/api/users", async (req, reply) => {
  const breaker = circuitBreaker.userService;
  const apiKey = req.headers["x-api-key"];
  const cacheKey = `users_${apiKey}`;

  if (breaker.open) {
    if (Date.now() - breaker.lastFailureTime > 10000) {
      breaker.open = false;
      breaker.failures = 0;
    } else {
      return reply.send({ message: "User service down", data: [] });
    }
  }

  const cached = await getCache(cacheKey);
  if (cached) return reply.send({ data: cached, source: "CACHE" });

  try {
    const url = getUserServer();
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Service error: ${res.status}`);
    const data = await res.json();
    breaker.failures = 0;
    await setCache(cacheKey, data);
    return reply.send({ data, source: "SERVICE" });
  } catch (err) {
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    if (breaker.failures >= 3) breaker.open = true;
    return reply.status(500).send({ error: "User service crashed" });
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
      return reply.send({ message: "Order service down", data: [] });
    }
  }

  const cached = await getCache(cacheKey);
  if (cached) return reply.send({ data: cached, source: "CACHE" });

  try {
    const url = process.env.ORDER_SERVICE;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Service error: ${res.status}`);
    const data = await res.json();
    breaker.failures = 0;
    await setCache(cacheKey, data);
    return reply.send({ data, source: "SERVICE" });
  } catch (err) {
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    if (breaker.failures >= 3) breaker.open = true;
    return reply.status(500).send({ error: "Order service crashed" });
  }
});

// --- SERVER START ---
fastify.ready(() => {
  console.log("--- REGISTERED ROUTES ---");
  console.log(fastify.printRoutes());
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});