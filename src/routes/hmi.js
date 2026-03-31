import fs from "node:fs";
import fss from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { ERROR_CODES } from "../errorCodes.js";

//const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HMI_DIR = path.resolve("data/hmi");

export default async function hmiRoutes(fastify) {
    fastify.get("/api/v2/hmi/projects", async (_, reply) => {
        try {
            const entries = await fss.readdir(HMI_DIR, {
                withFileTypes: true,
            });

            const projectDirs = entries.filter((e) => e.isDirectory());

            const settled = await Promise.allSettled(
                projectDirs.map(async (dir) => {
                    const projectId = dir.name;
                    const projectDir = path.join(HMI_DIR, projectId);
                    const metaPath = path.join(projectDir, "meta.json");
                    const projectPath = path.join(
                        projectDir,
                        "project.tir-project",
                    );

                    let meta = {};
                    try {
                        const metaText = await fss.readFile(metaPath, "utf-8");
                        meta = JSON.parse(metaText);
                    } catch (error) {
                        fastify.log.warn(
                            { error, projectId, metaPath },
                            "Error reading meta.json",
                        );
                        return null;
                    }

                    const projectStat = await fss
                        .stat(projectPath)
                        .catch(() => null);

                    return {
                        id:
                            typeof meta.id === "string" && meta.id
                                ? meta.id
                                : projectId,
                        name:
                            typeof meta.projectName === "string" &&
                            meta.projectName
                                ? meta.projectName
                                : "Untitled",
                        size: projectStat?.size ?? 0,
                        mtime: projectStat?.mtimeMs ?? 0,
                        thumbnail: `/api/v2/hmi/projects/${projectId}/thumbnail`,
                    };
                }),
            );
            const items = [];
            for (const result of settled) {
                if (result.status === "fulfilled" && result.value) {
                    items.push(result.value);
                } else if (result.status === "rejected") {
                    fastify.log.warn(
                        { error: result.reason },
                        "Error reading project",
                    );
                }
            }

            items.sort((a, b) => b.mtime - a.mtime);
            return reply.send({items});
        } catch (error) {
            fastify.log.error(error);
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    fastify.get("/api/v2/hmi/projects/:id/thumbnail", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return reply
                .code(400)
                .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
        }

        const { thumb } = getProjectPaths(id);

        try {
            await fss.access(thumb, fs.constants.F_OK);
            reply.header("Content-Type", "image/png");
            const stream = fs.createReadStream(thumb);
            return reply.send(stream);
        } catch (error) {
            // Если миниатюры нет, отдаем заглушку или 404
            if (error.code === "ENOENT") {
                return reply
                    .code(404)
                    .send({ error: { code: ERROR_CODES.NOT_FOUND } });
            }
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    fastify.get("/api/v2/hmi/projects/:id", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return reply
                .code(400)
                .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
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
                return reply
                    .code(404)
                    .send({ error: { code: ERROR_CODES.NOT_FOUND } });
            }
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    fastify.delete("/api/v2/hmi/projects/:id", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return reply
                .code(400)
                .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
        }

        const { dir } = getProjectPaths(id);

        try {
            await fss.access(dir, fs.constants.F_OK);
            await fss.rm(dir, { recursive: true, force: false });

            return reply.code(204).send();
        } catch (error) {
            if (error.code === "ENOENT") {
                return reply
                    .code(404)
                    .send({ error: { code: ERROR_CODES.NOT_FOUND } });
            }
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    fastify.put("/api/v2/hmi/projects/:id", async (req, reply) => {
        const { id } = req.params;

        if (!isValidProjectId(id)) {
            return reply
                .code(400)
                .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
        }

        if (!req.isMultipart || !req.isMultipart()) {
            return reply.code(400).send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
        }

        const data = await req.file();
        if (!data) {
            return reply
                .code(400)
                .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
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
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PACKAGE } });
            }

            const manifestBuffer = manifestEntry.getData();
            let manifest;

            try {
                manifest = JSON.parse(manifestBuffer.toString("utf-8"));
            } catch {
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PACKAGE } });
            }

            if (manifest.projectId && manifest.projectId !== id) {
                return reply
                    .code(409)
                    .send({ error: { code: ERROR_CODES.PROJECT_ID_MISMATCH } });
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

            return reply.code(201).send();
        } catch (error) {
            fastify.log.error(error);
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
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
