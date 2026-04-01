import { ERROR_CODES } from "../errorCodes.js";

const STEP_MESSAGES = {
    checking: "checking for updates...",
    downloading: "downloading update...",
    verifying: "verifying files...",
    extracting: "extracting...",
    installing: "installing update...",
    finishing: "finishing process...",
    done: "update completed!",
};

const STEP_PROGRESS = {
    checking: 5,
    downloading: 20,
    verifying: 40,
    extracting: 55,
    installing: 80,
    finishing: 95,
    done: 100,
};

const STEP_TO_PHASE = {
    checking: "installing",
    downloading: "installing",
    verifying: "installing",
    extracting: "installing",
    installing: "installing",
    finishing: "installing",
    done: "success",
};

const steps = [
    "checking",
    "downloading",
    "verifying",
    "extracting",
    "installing",
    "finishing",
    "done",
];

// В реальности это лучше вынести в файл/стейт вне памяти процесса.
// Пока оставим in-memory mock.
let currentUpdate = null;

function buildIdleStatus() {
    return {
        phase: "idle",
        progress: 0,
        message: "idle",
        log: [],
        updatedAt: new Date().toISOString(),
    };
}

function buildStatusFromUpdate(update) {
    const step = update.step;
    return {
        phase: STEP_TO_PHASE[step],
        progress: STEP_PROGRESS[step],
        message: STEP_MESSAGES[step],
        log: update.log,
        updatedAt: update.updatedAt,
    };
}

function advanceMockUpdate(update) {
    const currentIndex = steps.indexOf(update.step);
    if (currentIndex < 0) return update;

    const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
    const nextStep = steps[nextIndex];

    if (nextStep !== update.step) {
        update.step = nextStep;
        update.updatedAt = new Date().toISOString();
        update.log = [
            ...update.log,
            `[${update.updatedAt}] ${STEP_MESSAGES[nextStep]}`,
        ];
    }

    return update;
}

export default async function updatesRoutes(fastify) {
    fastify.post("/api/v2/update", async (req, reply) => {
        if (!req.isMultipart || !req.isMultipart()) {
            return reply.code(400).send({
                error: { code: ERROR_CODES.INVALID_PAYLOAD },
            });
        }

        const data = await req.file();
        if (!data) {
            return reply.code(400).send({
                error: { code: ERROR_CODES.INVALID_PAYLOAD },
            });
        }

        if (currentUpdate && currentUpdate.step !== "done") {
            return reply.code(409).send({
                error: { code: ERROR_CODES.ALREADY_IN_PROGRESS },
            });
        }

        const now = new Date().toISOString();

        currentUpdate = {
            step: "checking",
            log: [`[${now}] ${STEP_MESSAGES.checking}`],
            updatedAt: now,
        };

        return reply.code(202).send({
            phase: "installing",
            progress: STEP_PROGRESS.checking,
            message: STEP_MESSAGES.checking,
            log: currentUpdate.log,
            updatedAt: currentUpdate.updatedAt,
        });
    });

    fastify.get("/api/v2/update/status", async (_, reply) => {
        if (!currentUpdate) {
            return reply.send(buildIdleStatus());
        }

        await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));

        advanceMockUpdate(currentUpdate);

        const response = buildStatusFromUpdate(currentUpdate);

        if (currentUpdate.step === "done") {
            currentUpdate = null;
        }

        return reply.send(response);
    });
}