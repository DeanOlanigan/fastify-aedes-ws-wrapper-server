import { buildSignalHistoryResponse } from "./buildSignalHistoryResponse.js";
import { parseSignalHistoryBody } from "./parseSignalHistoryBody.js";

export function createSignalHistoryService({ repository }) {
    return {
        async query(rawBody) {
            const query = parseSignalHistoryBody(rawBody);
            const items = await repository.load();
            return buildSignalHistoryResponse(items, query);
        },
    };
}