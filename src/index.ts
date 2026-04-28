import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { PruneRouter } from "./router";
import {
	PRUNE_REGISTER_PROVIDER_EVENT,
	PRUNE_REQUEST_EVENT,
	type PruneProviderRegistration,
	type PruneRequest,
	type PruneRequestEvent,
} from "./types";

export default function (pi: ExtensionAPI) {
	const router = new PruneRouter();

	pi.events.on(PRUNE_REGISTER_PROVIDER_EVENT, (payload) => {
		try {
			router.registerProvider(payload as PruneProviderRegistration);
		} catch (error) {
			console.error("[pi-prune-router] failed to register provider", error);
		}
	});

	pi.events.on(PRUNE_REQUEST_EVENT, (payload) => {
		const event = payload as PruneRequestEvent;
		void router.prune(event.request, event.signal).then(event.resolve, event.reject);
	});

	pi.registerTool({
		name: "prune_context",
		label: "Prune Context",
		description: "Prune already-selected text/documents against a goal using the registered prune provider router.",
		promptSnippet: "Prune already-selected large text/documents against a goal before adding them to context.",
		promptGuidelines: [
			"Use prune_context only for already-selected content; do not use it to discover files or search the filesystem.",
			"Use prune_context when a large tool result, fetched page, or pasted text needs to be reduced while preserving task-relevant details.",
		],
		parameters: Type.Object({
			goal: Type.String({ description: "What details must be preserved in the pruned output." }),
			input: Type.Union([
				Type.String(),
				Type.Array(Type.String()),
				Type.Object({
					id: Type.Optional(Type.String()),
					source: Type.Optional(Type.String()),
					text: Type.String(),
				}),
				Type.Array(
					Type.Object({
						id: Type.Optional(Type.String()),
						source: Type.Optional(Type.String()),
						text: Type.String(),
					}),
				),
			]),
			preserve: Type.Optional(Type.Array(Type.String())),
			budget: Type.Optional(
				Type.Object({
					tokens: Type.Optional(Type.Number()),
					chars: Type.Optional(Type.Number()),
					ratio: Type.Optional(Type.Number()),
				}),
			),
			options: Type.Optional(
				Type.Object({
					provider: Type.Optional(Type.String()),
					threshold: Type.Optional(Type.Number()),
					lineNumbers: Type.Optional(Type.Boolean()),
					timeoutMs: Type.Optional(Type.Number()),
				}),
			),
		}),
		async execute(_toolCallId, params, signal) {
			const result = await router.prune(params as PruneRequest, signal);
			return {
				content: [{ type: "text", text: result.text }],
				details: result,
			};
		},
	});
}

export * from "./types";
export { PruneRouter } from "./router";
