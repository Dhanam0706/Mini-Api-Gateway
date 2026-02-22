const fastify = require('fastify')({ logger: true });

fastify.get('/users', async (req, reply) => {
  return {
    service: "USER SERVICE",
    users: ["Dhanam", "Venu", "Deepak", "Sathya"]
  };
});

const PORT = process.argv[2] || 4001; // Allows running multiple instances
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) console.error(err);
  console.log(`User Service listening on ${PORT}`);
});