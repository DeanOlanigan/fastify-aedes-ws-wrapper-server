import argon2 from "argon2";

export async function verifyPassword(passwordHash, plainPassword) {
    if (!passwordHash || typeof passwordHash !== "string") return false;
    if (!plainPassword || typeof plainPassword !== "string") return false;
    try {
        return await argon2.verify(passwordHash, plainPassword);
    } catch {
        return false;
    }
}

export async function hashPassword(plainPassword) {
    return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export function findUserByLogin(users, login) {
    if (!login || typeof login !== "string") return null;
    const normalized = login.trim().toLowerCase();

    return (
        Object.entries(users).find(
            ([, user]) =>
                typeof user?.login === "string" &&
                user.login.trim().toLowerCase() === normalized
        ) ?? null
    );
}

export function collectRights(user, rolesMap) {
    const rights = new Set();

    for (const roleId of user.roles ?? []) {
        const role = rolesMap[roleId];
        if (!role) continue;
        for (const right of role.rights ?? []) rights.add(right);
    }

    return [...rights];
}