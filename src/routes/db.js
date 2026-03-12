export default async function dbRoutes(fastify) {
    fastify.get("/api/v2/graph", async (req, reply) => {
        const { start, end, points, vars } = req.query;
        const variables = vars?.split(",") ?? [];
        try {
            const rows = await fastify.db.all(
                `SELECT *
                FROM TELEMETRY
                WHERE VarName in (${variables.map(() => "?").join(",")})
                    AND DateTime BETWEEN ? and ?
                ORDER BY DateTime ASC
                LIMIT ?`,
                [...variables, start, end, points]
            );

            return reply.send({ ok: true, data: rows });
        } catch (err) {
            req.log.error({ err }, "Error getting graph data");
            return reply
                .code(500)
                .send({ ok: false, error: "Error getting graph data" });
        }
    });

    fastify.post("/api/v2/gdata", async (req, reply) => {
        const rows = generateChartData();

        try {
            const stmt = await fastify.db.prepare(
                `INSERT INTO TELEMETRY (DateTime, VarName, VarDesc, VarValue, MeasurementID) VALUES (?, ?, ?, ?, ?)`
            );
            await fastify.db.exec("BEGIN");
            for (const r of rows) {
                await stmt.run(r.ts, r.name, r.desc, r.value, r.measurement);
            }
            await fastify.db.exec("COMMIT");
            await stmt.finalize();

            return reply.send({ ok: true, count: rows.length });
        } catch {
            await fastify.db.exec("ROLLBACK");
            req.log.error(err);
            return reply
                .code(500)
                .send({ ok: false, error: "Error saving data" });
        }
    });
}

export function generateChartData() {
    const startDate = 1759198500000;
    const endDate = 1759844787679;
    const points = 1000;
    const variables = {
        1759750969239: {
            id: 1759750969239,
            color: "#DC143C",
            name: "IRZGPIO_BattLow",
        },
        1759848777569: {
            id: 1759848777569,
            color: "#FF33A6",
            name: "IRZGPIO_DoorOpen",
        },
        1759848778773: {
            id: 1759848778773,
            color: "#33FF57",
            name: "IRZGPIO_ACOk",
        },
        1759848780488: {
            id: 1759848780488,
            color: "#3357FF",
            name: "OvenSt_RPV",
        },
    };
    const rows = [];
    const timeStep = (endDate - startDate) / points;

    for (const v of Object.values(variables)) {
        for (let i = 0; i < points; i++) {
            const ts = Math.round(startDate + i * timeStep);
            const value = Math.sin(i / 5) * 20 + 50 + Math.random() * 5;

            rows.push({
                ts: String(ts),
                name: v.name,
                desc: `${v.name} description`,
                value,
                measurement: 10,
            });
        }
    }

    return rows;
}
