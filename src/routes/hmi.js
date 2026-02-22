import fss from "fs/promises";
import fs from "fs";
import path from "path";
import { send } from "./utils.js";
import { pipeline } from "stream/promises";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

        await delay(1500);

        return send(reply, 200, "HMI projects successfully retrieved", stats);
    });

    fastify.get("/api/v2/hmi/project/:name", async (req, reply) => {
        const { name } = req.params;

        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
            return send(reply, 400, "Invalid project name");
        }

        const dirPath = path.resolve("./src/data/hmi");
        const fileName = name.endsWith(".tir-project") ? name : `${name}.tir-project`;
        const fullPath = path.join(dirPath, fileName);

        await delay(1500);

        try {

            await fs.promises.access(fullPath, fs.constants.F_OK);

            reply.header("Content-Type", "application/octet-stream");
            reply.header("Content-Disposition", `attachment; filename="${fileName}"`);

            const stream = fs.createReadStream(fullPath);
            return reply.send(stream);
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Project not found");
            }
            return send(reply, 500, "Error reading project", error);
        }
    });

    fastify.delete("/api/v2/hmi/project/:name", async (req, reply) => {
        const { name } = req.params;
        const dirPath = path.resolve("./src/data/hmi");
        const fullPath = path.join(dirPath, name);

        await delay(1500);

        try {
            await fss.unlink(fullPath);
            return send(reply, 200, "HMI project successfully deleted");
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Project not found");
            }
            return send(reply, 500, "Error deleting project", error);
        }
    });

    fastify.put("/api/v2/hmi/project/:name", async (req, reply) => {
        const { name } = req.params;
        const dirPath = path.resolve("./src/data/hmi");

        const fileName = name.endsWith(".tir-project") ? name : `${name}.tir-project`;
        const fullPath = path.join(dirPath, fileName);

        const data = await req.file();
        if (!data) {
            return send(reply, 400, "No file uploaded");
        }

        await delay(1500);

        try {
            await fss.mkdir(dirPath, { recursive: true });

            await pipeline(
                data.file,
                fs.createWriteStream(fullPath)
            );
            return send(reply, 200, "HMI project successfully updated");
        } catch (error) {
            return send(reply, 500, "Error saving project", error);
        }
    });

}
