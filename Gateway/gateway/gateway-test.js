const fastify = require('fastify')({ logger: true });

fastify.get('/health', async () => {
  return { status: "Gateway OK", time: new Date() };
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) console.error(err);
  console.log("Listening on port 3000");
});
