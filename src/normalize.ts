import type { NormalizedPruneRequest, PruneDocument, PruneInput, PruneRequest } from "./types";

export function normalizePruneRequest(request: PruneRequest): NormalizedPruneRequest {
	const documents = normalizeInput(request.input);
	if (documents.length === 0) {
		throw new Error("prune request must include at least one input document");
	}
	if (!request.goal?.trim()) {
		throw new Error("prune request requires a non-empty goal");
	}
	return {
		goal: request.goal,
		documents,
		preserve: request.preserve,
		budget: request.budget,
		metadata: request.metadata,
		options: request.options,
	};
}

export function normalizeInput(input: PruneInput): PruneDocument[] {
	const items = Array.isArray(input) ? input : [input];
	return items.map((item, index) => {
		if (typeof item === "string") {
			return {
				id: `input-${index + 1}`,
				source: items.length === 1 ? "input" : `input-${index + 1}`,
				text: item,
			};
		}
		if (!item || typeof item !== "object") {
			throw new Error(`invalid prune input at index ${index}`);
		}
		if (typeof item.text !== "string") {
			throw new Error(`prune document at index ${index} must include text`);
		}
		return {
			...item,
			id: item.id ?? `input-${index + 1}`,
			source: item.source ?? item.id ?? `input-${index + 1}`,
		};
	});
}
