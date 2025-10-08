import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fp from "fastify-plugin";

export const sqlitePlugin = fp(async (fastify, opts) => {
    const db = await open({
        filename: opts.filename ?? "./src/data/db/sd/sqlite.db",
        driver: sqlite3.Database,
    });

    await db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
    `);

    fastify.decorate("db", db);

    fastify.addHook("onClose", async (app, done) => {
        try {
            await db.close();
            done();
        } catch (err) {
            done(err);
        }
    });
});
