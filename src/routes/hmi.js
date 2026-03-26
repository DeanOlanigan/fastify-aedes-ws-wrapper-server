import fs from "node:fs";
import fss from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { send } from "./utils.js";

//const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HMI_DIR = path.resolve("data/hmi");

export default async function hmiRoutes(fastify) {
    fastify.get("/api/v2/hmi/projects", async (_, reply) => {
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
                    thumbnail: `/api/v2/hmi/projects/${projectId}/thumbnail`,
                }
            }),
        )

        items.sort((a, b) => b.mtime - a.mtime);
        return send(reply, 200, "HMI projects successfully retrieved", items);
    })

    fastify.get("/api/v2/hmi/projects/:id/thumbnail", async (req, reply) => {
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

    fastify.get("/api/v2/hmi/projects/:id", async (req, reply) => {
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

    fastify.delete("/api/v2/hmi/projects/:id", async (req, reply) => {
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

    fastify.put("/api/v2/hmi/projects/:id", async (req, reply) => {
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