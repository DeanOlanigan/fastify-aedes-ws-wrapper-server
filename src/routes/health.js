export default async function healthRoutes(fastify) {
    // GET /health
    fastify.get("/health", async () => ({ ok: true, ts: Date.now() }));
}
