#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SIGNAL_TYPES = [
    "sine",
    "noisySine",
    "step",
    "trend",
    "binary",
    "spike",
];

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function roundValue(value, digits = 3) {
    return Number(value.toFixed(digits));
}

function buildVariableNames(count) {
    return Array.from({ length: count }, (_, i) => `variable${i + 1}`);
}

function buildTimeRange({ from, to, days }) {
    const nowMs = Date.now();
    const toMs = to ? new Date(to).getTime() : nowMs;
    const fromMs = from
        ? new Date(from).getTime()
        : toMs - days * 24 * 60 * 60 * 1000;

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
        throw new Error("Некорректные значения --from или --to");
    }

    if (fromMs > toMs) {
        throw new Error("--from не может быть больше --to");
    }

    return { fromMs, toMs };
}

function createVariableProfile(variable, datasetIndex) {
    const kind = pickRandom(SIGNAL_TYPES);
    const base = 40 + datasetIndex * 10 + randomBetween(-5, 5);

    switch (kind) {
        case "sine":
            return {
                variable,
                kind,
                params: {
                    base,
                    amplitude: randomBetween(8, 20),
                    freq: randomBetween(0.04, 0.12),
                    phase: randomBetween(0, Math.PI * 2),
                    noise: randomBetween(0.2, 1.2),
                },
            };

        case "noisySine":
            return {
                variable,
                kind,
                params: {
                    base,
                    amplitude: randomBetween(10, 24),
                    freq: randomBetween(0.05, 0.16),
                    phase: randomBetween(0, Math.PI * 2),
                    noise: randomBetween(1.5, 4.5),
                },
            };

        case "step":
            return {
                variable,
                kind,
                params: {
                    min: base - randomBetween(10, 20),
                    max: base + randomBetween(10, 20),
                    segmentLength: randomInt(8, 30),
                    jitter: randomBetween(0.1, 1.2),
                },
            };

        case "trend":
            return {
                variable,
                kind,
                params: {
                    start: base - randomBetween(5, 15),
                    slope: randomBetween(-0.15, 0.25),
                    noise: randomBetween(0.2, 1.5),
                    waveAmplitude: randomBetween(0, 4),
                    waveFreq: randomBetween(0.03, 0.08),
                },
            };

        case "binary":
            return {
                variable,
                kind,
                params: {
                    low: randomBetween(0, 5),
                    high: base + randomBetween(15, 30),
                    flipChance: randomBetween(0.03, 0.12),
                    noise: randomBetween(0, 0.3),
                },
            };

        case "spike":
            return {
                variable,
                kind,
                params: {
                    base,
                    noise: randomBetween(0.2, 1.5),
                    spikeChance: randomBetween(0.01, 0.04),
                    spikeHeight: randomBetween(15, 40),
                    recovery: randomBetween(0.4, 0.85),
                },
            };

        default:
            return {
                variable,
                kind: "sine",
                params: {
                    base,
                    amplitude: 10,
                    freq: 0.08,
                    phase: 0,
                    noise: 1,
                },
            };
    }
}

function createSeriesValue(profile, pointIndex, state) {
    const { kind, params } = profile;

    switch (kind) {
        case "sine":
        case "noisySine": {
            return (
                params.base +
                Math.sin(pointIndex * params.freq + params.phase) *
                    params.amplitude +
                randomBetween(-params.noise, params.noise)
            );
        }

        case "step": {
            const segmentIndex = Math.floor(pointIndex / params.segmentLength);
            const level = segmentIndex % 2 === 0 ? params.min : params.max;
            return level + randomBetween(-params.jitter, params.jitter);
        }

        case "trend": {
            return (
                params.start +
                pointIndex * params.slope +
                Math.sin(pointIndex * params.waveFreq) * params.waveAmplitude +
                randomBetween(-params.noise, params.noise)
            );
        }

        case "binary": {
            if (pointIndex === 0) {
                state.binaryValue =
                    Math.random() > 0.5 ? params.high : params.low;
            } else if (Math.random() < params.flipChance) {
                state.binaryValue =
                    state.binaryValue === params.high
                        ? params.low
                        : params.high;
            }

            return (
                state.binaryValue +
                randomBetween(-params.noise, params.noise)
            );
        }

        case "spike": {
            if (pointIndex === 0) {
                state.spikeCarry = 0;
            }

            if (Math.random() < params.spikeChance) {
                state.spikeCarry = params.spikeHeight;
            } else {
                state.spikeCarry *= params.recovery;
            }

            return (
                params.base +
                state.spikeCarry +
                randomBetween(-params.noise, params.noise)
            );
        }

        default:
            return params.base ?? 0;
    }
}

function buildTimeseriesItems({
    fromMs,
    toMs,
    variableCount,
    pointsPerVariable,
    jitterRatio = 0.05,
}) {
    const variableNames = buildVariableNames(variableCount);
    const profiles = variableNames.map((variable, datasetIndex) =>
        createVariableProfile(variable, datasetIndex),
    );

    const duration = toMs - fromMs;
    const step =
        pointsPerVariable > 1 ? duration / (pointsPerVariable - 1) : 0;

    const items = [];

    for (const profile of profiles) {
        const state = {};

        for (let pointIndex = 0; pointIndex < pointsPerVariable; pointIndex++) {
            const nominalTs = fromMs + pointIndex * step;

            const jitter =
                step > 0
                    ? randomBetween(-step * jitterRatio, step * jitterRatio)
                    : 0;

            const ts = Math.round(
                Math.max(fromMs, Math.min(toMs, nominalTs + jitter)),
            );

            const value = roundValue(
                createSeriesValue(profile, pointIndex, state),
                3,
            );

            items.push({
                ts,
                variable: profile.variable,
                value,
            });
        }
    }

    items.sort((a, b) => {
        if (a.ts !== b.ts) return a.ts - b.ts;
        return a.variable.localeCompare(b.variable);
    });

    return { items, profiles };
}

function parseArgs(argv) {
    const args = {
        out: "./data/mock-timeseries-db.json",
        variableCount: 5,
        pointsPerVariable: 300,
        days: 7,
        format: "json", // json | jsonl
        from: null,
        to: null,
        jitterRatio: 0.05,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === "--out") {
            args.out = argv[++i];
        } else if (arg === "--variables") {
            args.variableCount = Number(argv[++i]);
        } else if (arg === "--points") {
            args.pointsPerVariable = Number(argv[++i]);
        } else if (arg === "--days") {
            args.days = Number(argv[++i]);
        } else if (arg === "--format") {
            args.format = argv[++i];
        } else if (arg === "--from") {
            args.from = argv[++i];
        } else if (arg === "--to") {
            args.to = argv[++i];
        } else if (arg === "--jitter") {
            args.jitterRatio = Number(argv[++i]);
        }
    }

    return args;
}

async function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, items, meta) {
    const payload = {
        schemaVersion: 1,
        generatedAt: Date.now(),
        meta,
        items,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function writeJsonl(filePath, items) {
    const content = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
    await fs.writeFile(filePath, content, "utf8");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const { fromMs, toMs } = buildTimeRange(args);

    const { items, profiles } = buildTimeseriesItems({
        fromMs,
        toMs,
        variableCount: args.variableCount,
        pointsPerVariable: args.pointsPerVariable,
        jitterRatio: args.jitterRatio,
    });

    const meta = {
        fromMs,
        toMs,
        variableCount: args.variableCount,
        pointsPerVariable: args.pointsPerVariable,
        totalItems: items.length,
        jitterRatio: args.jitterRatio,
        variables: profiles.map((profile) => ({
            variable: profile.variable,
            kind: profile.kind,
            params: profile.params,
        })),
    };

    await ensureDir(args.out);

    if (args.format === "jsonl") {
        await writeJsonl(args.out, items);
    } else {
        await writeJson(args.out, items, meta);
    }

    console.log(
        `Готово. Сгенерировано ${items.length} точек для ${args.variableCount} переменных: ${args.out}`,
    );
}

main().catch((error) => {
    console.error("Ошибка генерации timeseries mock db:");
    console.error(error);
    process.exit(1);
});