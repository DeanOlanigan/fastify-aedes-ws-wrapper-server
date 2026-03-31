import { v7 as uuidv7 } from "uuid";

export default async function licenseRoutes(fastify) {
    // TODO: Уточнить требования к этому эндпоинту и реализовать его
    fastify.get("/api/v2/license", async (_, reply) => {
        const isActive = Math.random() < 0.5; // Случайно активна или нет для демонстрации
        return reply.send({
            isActive,
            expireDate: isActive ? "2028-12-31T23:59:59.000Z" : null,
            someData: {
                company: "Example Company",
                licenseType: "Pro",
                maxDevices: 100,
            },
            deviceCode: uuidv7(),
        });
    })

    fastify.post("/api/v2/license/activate", async (req, reply) => {
        const { licenseKey } = req.body;
        const isActive = Math.random() < 0.5; // Случайно активна или нет для демонстрации
        return reply.send({
            success: isActive,
            expireDate: isActive ? "2028-12-31T23:59:59.000Z" : null,
            someData: {
                company: "Example Company",
                licenseType: "Pro",
                maxDevices: 100,
            },
            licenseKey,
        });
    })
}
