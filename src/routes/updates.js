export default async function updatesRoutes(fastify) {

    fastify.post("/api/v2/getUpdate", async (req, reply) => {
        reply.status(200);
        return JSON.stringify(req.body)
    })

    fastify.get("/api/v2/checkUpdate", async (_, reply) => {
        const steps = [
            "checking",
            "downloading",
            "verifying",
            "extracting",
            "installing",
            "finishing",
            "done"
        ];

        const step = steps[Math.floor(Math.random() * steps.length)];

        const progress =
            step === "done"
                ? 100
                : Math.floor(Math.random() * 95);

        await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));

        return reply.send({
            status: step,
            progress: progress,
            message: {
                checking: "Проверка обновлений...",
                downloading: "Загрузка обновления...",
                verifying: "Проверка файлов...",
                extracting: "Распаковка...",
                installing: "Установка обновления...",
                finishing: "Завершение процесса...",
                done: "Обновление завершено!"
            }[step],
            timestamp: Date.now()
        });
    });
}
