import { createSignalHistoryRepository } from "./createSignalHistoryRepository.js";
import { createSignalHistoryService } from "./signal-history-service.js";

export default async function graphRoutes(fastify) {

    const signalHistoryRepository = createSignalHistoryRepository({
        filePath: "./data/db/timeseries-mock.json",
    });

    const signalHistoryService = createSignalHistoryService({
        repository: signalHistoryRepository,
    });

    fastify.post("/api/v2/signals/history", async (req, reply) => {
        try {
            const result = await signalHistoryService.query(req.body);
            return reply.send(result);
        } catch (error) {
            if (error?.statusCode) {
                return reply.code(error.statusCode).send({
                    error: error.message,
                });
            }

            req.log.error(error);
            return reply.code(500).send({
                error: "internal error",
            });
        }
    });
}