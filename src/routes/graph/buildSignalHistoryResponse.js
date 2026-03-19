function groupItemsByVariable(items, requestedVariables) {
    const result = new Map();

    for (const variable of requestedVariables) {
        result.set(variable, []);
    }

    for (const item of items) {
        if (!result.has(item.variable)) continue;
        result.get(item.variable).push(item);
    }

    for (const points of result.values()) {
        points.sort((a, b) => a.ts - b.ts);
    }

    return result;
}

function downsamplePoints(points, limit) {
    if (points.length <= limit) return points;
    if (limit <= 1) return [points[points.length - 1]];

    const lastIndex = points.length - 1;
    const result = [];

    for (let i = 0; i < limit; i++) {
        const index = Math.round((i * lastIndex) / (limit - 1));
        result.push(points[index]);
    }

    return result;
}

export function buildSignalHistoryResponse(items, query) {
    const requestedNames = query.variables.map((v) => v.name);
    const requestedSet = new Set(requestedNames);

    const filtered = items.filter(
        (item) =>
            item.ts >= query.fromMs &&
            item.ts <= query.toMs &&
            requestedSet.has(item.variable),
    );

    const grouped = groupItemsByVariable(filtered, requestedNames);

    return {
        from: query.from,
        to: query.to,
        pointLimit: query.pointLimit,
        series: query.variables.map((variable) => {
            const points = grouped.get(variable.name) ?? [];
            const sampled = downsamplePoints(points, query.pointLimit);

            return {
                id: variable.id,
                name: variable.name,
                points: sampled.map((point) => ({
                    ts: point.ts,
                    value: point.value,
                })),
            };
        }),
    };
}