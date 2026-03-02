import { collectRights } from "./auth.js";

export function buildSessionUser(userId, user, rolesMap, prev = {}) {
    return {
        userId,
        login: user.login,
        surname: user.surname,
        name: user.name,
        grandname: user.grandname,
        position: user.position,
        roles: user.roles ?? [],
        rights: collectRights(user, rolesMap),
        authzVersion: user.authzVersion ?? 1,
        mustChangePassword: !!user.mustChangePassword,
        createdAt: prev.createdAt ?? Date.now(),
        lastActivityAt: Date.now(),
        stepUpUntil: prev.stepUpUntil ?? 0,
    };
}