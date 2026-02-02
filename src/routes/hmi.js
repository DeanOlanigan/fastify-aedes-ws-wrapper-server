import fss from "fs/promises";
import path from "path";
import { send } from "./utils.js";


export default async function hmiRoutes(fastify, opts) {
    fastify.get("/api/v2/hmi/projects", async (req, reply) => {
        const dirPath = path.resolve("./src/data/hmi");
        const entries = await fss.readdir(dirPath, {
            withFileTypes: true,
        });
        const files = entries.filter((entry) => entry.isFile());
        const stats = await Promise.all(
            files.map(async (file) => {
                const fullPath = path.join(dirPath, file.name);
                const st = await fss.stat(fullPath);
                return {
                    label: file.name,
                    value: file.name,
                    size: st.size,
                    mtime: st.mtime,
                };
            }
        ));
        stats.sort((a, b) => b.mtime - a.mtime);
        return send(reply, 200, "HMI projects successfully retrieved", stats);
    });

    fastify.get("/api/v2/hmi/project/:name", async (req, reply) => {
        const { name } = req.params;

        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
            return send(reply, 400, "Invalid project name");
        }

        const dirPath = path.resolve("./src/data/hmi");
        const fullPath = path.join(dirPath, name);

        try {
            const content = await fss.readFile(fullPath, "utf-8");
            return send(reply, 200, "HMI project successfully retrieved", JSON.parse(content));
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Project not found");
            }
            return send(reply, 500, "Error reading project", error);
        }

    });

}
