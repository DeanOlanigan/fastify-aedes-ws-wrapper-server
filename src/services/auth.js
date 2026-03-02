import argon2 from "argon2";

export async function verifyPassword(passwordHash, plainPassword) {
    return argon2.verify(passwordHash, plainPassword);
}

export async function hashPassword(plainPassword) {
    return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export function findUserByLogin(users, login) {
    return Object.entries(users).find(
        ([, user]) => user.login.toLowerCase() === login.toLowerCase()
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