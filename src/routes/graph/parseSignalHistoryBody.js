import { clamp, createHttpError, isValidIsoDate } from "../utils.js";

const DEFAULT_POINT_LIMIT = 100;
const MAX_POINT_LIMIT = 1000;

export function parseSignalHistoryBody(body) {
    if (!body || typeof body !== "object") {
        throw createHttpError(400, "body is required");
    }

    const { from, to, pointLimit, variables } = body;

    if (!isValidIsoDate(from)) {
        throw createHttpError(400, "from is not valid ISO date");
    }

    if (!isValidIsoDate(to)) {
        throw createHttpError(400, "to is not valid ISO date");
    }

    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);

    if (fromMs > toMs) {
        throw createHttpError(400, "from > to");
    }

    const parsedLimit = Number.parseInt(pointLimit, 10);
    const limit = clamp(
        Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_POINT_LIMIT,
        1,
        MAX_POINT_LIMIT,
    );

    if (!Array.isArray(variables) || variables.length === 0) {
        throw createHttpError(400, "variables is required");
    }

    const normalizedVariables = variables.map((item, index) => {
        if (typeof item === "string") {
            const name = item.trim();
            if (!name) {
                throw createHttpError(400, `variables[${index}] is invalid`);
            }
            return {
                id: name,
                name,
            };
        }

        if (!item || typeof item !== "object") {
            throw createHttpError(400, `variables[${index}] is invalid`);
        }

        const name = String(item.name ?? "").trim();
        if (!name) {
            throw createHttpError(400, `variables[${index}].name is required`);
        }

        return {
            id: item.id != null ? String(item.id) : name,
            name,
        };
    });

    return {
        fromMs,
        toMs,
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        pointLimit: limit,
        variables: normalizedVariables,
    };
}