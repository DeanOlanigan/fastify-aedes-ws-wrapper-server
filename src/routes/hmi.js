import fs from "node:fs";
import fss from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { send } from "./utils.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function hmiRoutes(fastify) {
    fastify.get("/api/v2/hmi/projects", async (_, reply) => {
        const dirPath = path.resolve("./src/data/hmi");
        const entries = await fss.readdir(dirPath, {
            withFileTypes: true,
        });
        const metaFiles = entries.filter((e) => e.name.endsWith(".meta.json"));

        const stats = await Promise.all(
            metaFiles.map(async (file) => {
                const baseName = file.name.replace(".meta.json", "");
                const st = await fss.stat(
                    path.join(dirPath, `${baseName}.tir-project`),
                );

                return {
                    label: baseName,
                    value: baseName,
                    size: st.size,
                    mtime: st.mtime,
                    thumbnail: `/api/v2/hmi/project/${baseName}/thumbnail`,
                };
            }),
        );
        stats.sort((a, b) => b.mtime - a.mtime);

        await delay(1500);

        return send(reply, 200, "HMI projects successfully retrieved", stats);
    });

    fastify.get("/api/v2/hmi/project/:name/thumbnail", async (req, reply) => {
        const { name } = req.params;
        const thumbPath = path.resolve("./src/data/hmi", `${name}.thumb.png`);

        try {
            await fss.access(thumbPath);
            const stream = fs.createReadStream(thumbPath);
            reply.type("image/png");
            return reply.send(stream);
        } catch {
            // Если миниатюры нет, отдаем заглушку или 404
            return reply.code(404).send("No thumbnail");
        }
    });

    fastify.get("/api/v2/hmi/project/:name", async (req, reply) => {
        const { name } = req.params;

        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
            return send(reply, 400, "Invalid project name");
        }

        const dirPath = path.resolve("./src/data/hmi");
        const fileName = name.endsWith(".tir-project")
            ? name
            : `${name}.tir-project`;
        const fullPath = path.join(dirPath, fileName);

        await delay(1500);

        try {
            await fs.promises.access(fullPath, fs.constants.F_OK);

            reply.header("Content-Type", "application/octet-stream");
            reply.header(
                "Content-Disposition",
                `attachment; filename="${fileName}"`,
            );

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

        // Базовое имя без расширения
        const baseName = name.replace(".tir-project", "");
        const dirPath = path.resolve("./src/data/hmi");

        // Список всех файлов, связанных с проектом
        const filesToDelete = [
            path.join(dirPath, `${baseName}.tir-project`),
            path.join(dirPath, `${baseName}.meta.json`),
            path.join(dirPath, `${baseName}.thumb.png`),
        ];

        try {
            // Проверяем существование хотя бы основного файла (архива)
            await fss.access(filesToDelete[0]);

            // Удаляем все файлы параллельно
            await Promise.allSettled(
                filesToDelete.map((filePath) => fss.unlink(filePath)),
            );

            return reply
                .code(200)
                .send({ message: "HMI project and related assets deleted" });
        } catch (error) {
            if (error.code === "ENOENT") {
                return reply.code(404).send({ message: "Project not found" });
            }
            return reply.code(500).send({
                message: "Error deleting project",
                error: error.message,
            });
        }
    });

    fastify.put("/api/v2/hmi/project/:name", async (req, reply) => {
        const { name } = req.params;
        const dirPath = path.resolve("./src/data/hmi");

        const fileName = name.endsWith(".tir-project")
            ? name
            : `${name}.tir-project`;
        const fullPath = path.join(dirPath, fileName);

        const data = await req.file();
        if (!data) {
            return send(reply, 400, "No file uploaded");
        }

        await delay(1500);

        try {
            await fss.mkdir(dirPath, { recursive: true });

            await pipeline(data.file, fs.createWriteStream(fullPath));

            const zip = new AdmZip(fullPath);
            const zipEntries = zip.getEntries();

            // 1. Ищем миниатюру в архиве
            const thumbEntry = zipEntries.find(
                (e) => e.entryName === "thumbnail.png",
            );
            if (thumbEntry) {
                await fss.writeFile(
                    path.join(dirPath, `${name}.thumb.png`),
                    thumbEntry.getData(),
                );
            }

            // 2. Ищем манифест для метаданных
            const manifestEntry = zipEntries.find(
                (e) => e.entryName === "manifest.json",
            );
            if (manifestEntry) {
                await fss.writeFile(
                    path.join(dirPath, `${name}.meta.json`),
                    manifestEntry.getData(),
                );
            }

            return send(reply, 200, "HMI project successfully updated");
        } catch (error) {
            return send(reply, 500, "Error saving project", error);
        }
    });

    fastify.patch("/api/v2/hmi/project/:oldName/rename", async (req, reply) => {
        const { oldName } = req.params;
        const { newName } = req.body;
        const dirPath = path.resolve("./src/data/hmi");

        const extensions = [".tir-project", ".meta.json", ".thumb.png"];

        try {
            await Promise.all(
                extensions.map(async (ext) => {
                    const oldPath = path.join(dirPath, `${oldName}${ext}`);
                    const newPath = path.join(dirPath, `${newName}${ext}`);
                    // Используем try/catch внутри, так как превью может не быть
                    try {
                        await fss.access(oldPath);
                        await fss.rename(oldPath, newPath);
                    } catch {}
                }),
            );
            return reply.send({ message: "Renamed" });
        } catch {
            return reply.code(500).send({ message: "Rename failed" });
        }
    });
}
