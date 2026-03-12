import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const USERS_DIR = path.resolve("data/users");
const ROLES_DIR = path.resolve("data/roles");

const USERS_FILE = path.join(USERS_DIR, "users.json");
const ROLES_FILE = path.join(ROLES_DIR, "roles.json");

export async function loadUsers() {
    const raw = await readFile(USERS_FILE, "utf8");
    return JSON.parse(raw);
}

export async function loadRoles() {
    const raw = await readFile(ROLES_FILE, "utf8");
    return JSON.parse(raw);
}

async function atomicWriteJson(file, data) {
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, file);
}

export async function saveUsers(users) {
    await atomicWriteJson(USERS_FILE, users);
}

export async function saveRoles(roles) {
    await atomicWriteJson(ROLES_FILE, roles);
}
