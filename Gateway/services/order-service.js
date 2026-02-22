
const fastify = require('fastify')({ logger: true });

fastify.get('/orders', async (req, reply) => {
  return {
    service: "ORDER SERVICE",
    orders:["Mobile","Laptop","Earpods","Headset"]
  };
});

const PORT = process.argv[2] || 4002; // Allows running multiple instances
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) console.error(err);
  console.log(`Order Service listening on ${PORT}`);
});