import fss from "node:fs/promises";

export default async function healthRoutes(fastify) {
    // GET /health
    fastify.get("/health", async () => ({ ok: true, ts: Date.now() }));

    // GET /fun
    fastify.get("/fun", async (_, reply) => {
        const file = await fss.readFile("./src/data/out.bin");
        return reply.code(200).send(file);
    });
}
