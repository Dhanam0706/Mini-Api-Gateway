const redis = require("redis");
const client = redis.createClient({ url: "redis://127.0.0.1:6379" });

client.on("error", (err) => console.error("Redis Error:", err));
client.connect().then(() => console.log("Redis Connected")).catch(console.error);

module.exports = client;