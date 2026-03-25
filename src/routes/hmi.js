import fs from "node:fs";
import fss from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { send } from "./utils.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HMI_DIR = path.resolve("data/hmi");

export default async function hmiRoutes(fastify) {
    fastify.get("/api/v2/hmi/projects", async (_, reply) => {
        const entries = await fss.readdir(HMI_DIR, {
            withFileTypes: true,
        });
        const metaFiles = entries.filter((e) => e.name.endsWith(".meta.json"));

        const stats = await Promise.all(
            metaFiles.map(async (file) => {
                const baseName = file.name.replace(".meta.json", "");
                const st = await fss.stat(
                    path.join(HMI_DIR, `${baseName}.tir-project`),
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
        const thumbPath = path.resolve(HMI_DIR, `${name}.thumb.png`);

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

        const fileName = name.endsWith(".tir-project")
            ? name
            : `${name}.tir-project`;
        const fullPath = path.join(HMI_DIR, fileName);

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

        // Список всех файлов, связанных с проектом
        const filesToDelete = [
            path.join(HMI_DIR, `${baseName}.tir-project`),
            path.join(HMI_DIR, `${baseName}.meta.json`),
            path.join(HMI_DIR, `${baseName}.thumb.png`),
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

        const fileName = name.endsWith(".tir-project")
            ? name
            : `${name}.tir-project`;
        const fullPath = path.join(HMI_DIR, fileName);

        const data = await req.file();
        if (!data) {
            return send(reply, 400, "No file uploaded");
        }

        await delay(1500);

        try {
            await fss.mkdir(HMI_DIR, { recursive: true });

            await pipeline(data.file, fs.createWriteStream(fullPath));

            const zip = new AdmZip(fullPath);
            const zipEntries = zip.getEntries();

            // 1. Ищем миниатюру в архиве
            const thumbEntry = zipEntries.find(
                (e) => e.entryName === "thumbnail.png",
            );
            if (thumbEntry) {
                await fss.writeFile(
                    path.join(HMI_DIR, `${name}.thumb.png`),
                    thumbEntry.getData(),
                );
            }

            // 2. Ищем манифест для метаданных
            const manifestEntry = zipEntries.find(
                (e) => e.entryName === "manifest.json",
            );
            if (manifestEntry) {
                await fss.writeFile(
                    path.join(HMI_DIR, `${name}.meta.json`),
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

        const extensions = [".tir-project", ".meta.json", ".thumb.png"];

        try {
            await Promise.all(
                extensions.map(async (ext) => {
                    const oldPath = path.join(HMI_DIR, `${oldName}${ext}`);
                    const newPath = path.join(HMI_DIR, `${newName}${ext}`);
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

    // NEW API

    fastify.get("/api/v2/hmi/projects2", async (_, reply) => {
        const entries = await fss.readdir(HMI_DIR, {
            withFileTypes: true,
        });

        const projectDirs = entries.filter((e) => e.isDirectory());

        const items = await Promise.all(
            projectDirs.map(async (dir) => {
                const projectId = dir.name;
                const projectDir = path.join(HMI_DIR, projectId);
                const metaPath = path.join(projectDir, "meta.json");
                const projectPath = path.join(projectDir, "project.tir-project");

                const metaText = await fss.readFile(metaPath, "utf-8");
                const meta = JSON.parse(metaText);

                const projectStat = await fss.stat(projectPath).catch(() => null);

                return {
                    id: meta.id ?? projectId,
                    name: meta.projectName ?? "Untitled",
                    size: projectStat?.size ?? 0,
                    mtime: projectStat?.mtime ?? 0,
                    thumbnail: `/api/v2/hmi/project2/${projectId}/thumbnail`,
                }
            }),
        )

        items.sort((a, b) => b.mtime - a.mtime);
        return send(reply, 200, "HMI projects successfully retrieved", items);
    })

    fastify.get("/api/v2/hmi/project2/:id/thumbnail", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return send(reply, 400, "Invalid project id");
        }

        const { thumb } = getProjectPaths(id);

        try {
            await fss.access(thumb, fs.constants.F_OK);
            reply.header("Content-Type", "image/png");
            const stream = fs.createReadStream(thumb);
            return reply.send(stream);
        } catch {
            // Если миниатюры нет, отдаем заглушку или 404
            if (error.code === "ENOENT") {
                return send(reply, 404, "Thumbnail not found");
            }
            return send(reply, 500, "Error reading thumbnail", error);
        }
    });

    fastify.get("/api/v2/hmi/project2/:id", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return send(reply, 400, "Invalid project id");
        }

        const { archive } = getProjectPaths(id);

        try {
            await fss.access(archive, fs.constants.F_OK);

            reply.header("Content-Type", "application/octet-stream");
            reply.header(
                "Content-Disposition",
                `attachment; filename="${id}.tir-project"`,
            );

            return reply.send(fs.createReadStream(archive));
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Project not found");
            }
            return send(reply, 500, "Error reading project", error);
        }
    });

    fastify.delete("/api/v2/hmi/project2/:id", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return send(reply, 400, "Invalid project id");
        }

        const { dir } = getProjectPaths(id);

        try {
            await fss.access(dir, fs.constants.F_OK);
            await fss.rm(dir, { recursive: true, force: false });

            return send(reply, 200, "HMI project deleted");
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Project not found");
            }
            return send(reply, 500, "Error deleting project", error);
        }
    });

    fastify.put("/api/v2/hmi/project2/:id", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return send(reply, 400, "Invalid project id");
        }

        const data = await req.file();
        if (!data) {
            return send(reply, 400, "No file uploaded");
        }

        const paths = getProjectPaths(id);

        try {
            await fss.mkdir(paths.dir, { recursive: true });

            await pipeline(data.file, fs.createWriteStream(paths.archive));

            const zip = new AdmZip(paths.archive);
            const zipEntries = zip.getEntries();

            const manifestEntry = zipEntries.find(
                (e) => e.entryName === "manifest.json",
            );
            if (!manifestEntry) {
                return send(reply, 400, "Invalid project package: manifest.json is missing");
            }

            const manifestBuffer = manifestEntry.getData();
            let manifest;

            try {
                manifest = JSON.parse(manifestBuffer.toString("utf-8"));
            } catch {
                return send(reply, 400, "Invalid project package: manifest.json is malformed");
            }

            if (manifest.projectId && manifest.projectId !== id) {
                return send(reply, 409, "Project id in manifest does not match request id");
            }

            await fss.writeFile(paths.meta, manifestBuffer);

            const thumbEntry = zipEntries.find(
                (e) => e.entryName === "thumbnail.png",
            );

            if (thumbEntry) {
                await fss.writeFile(paths.thumb, thumbEntry.getData());
            } else {
                await fss.rm(paths.thumb, { force: true }).catch(() => {});
            }

            return send(reply, 200, "HMI project successfully saved");
        } catch (error) {
            return send(reply, 500, "Error saving project", error);
        }
    });
}

function isValidProjectId(id) {
    return /^[a-zA-Z0-9_-]+$/.test(id);
}

function getProjectDir(projectId) {
    return path.join(HMI_DIR, projectId);
}

function getProjectPaths(projectId) {
    const dir = getProjectDir(projectId);
    return {
        dir,
        archive: path.join(dir, "project.tir-project"),
        meta: path.join(dir, "meta.json"),
        thumb: path.join(dir, "thumb.png"),
    };
}