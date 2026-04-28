import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { expandLocalInput } from "./local-input";
import { PruneRouter } from "./router";
import {
	PRUNE_REGISTER_PROVIDER_EVENT,
	PRUNE_REQUEST_EVENT,
	type PruneProviderRegistration,
	type PruneRequest,
	type PruneRequestEvent,
} from "./types";

type PruneContextParams = {
	goal: string;
	input: string | string[];
	baseDir?: string;
	provider?: string;
	threshold?: number;
	maxFiles?: number;
	maxFileBytes?: number;
	lineNumbers?: boolean;
	timeoutMs?: number;
};

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
		description: "Prune local files, directories, or globs against a goal using the registered prune provider router. Returns plain text with real newlines.",
		promptSnippet: "Prune local files/directories/globs against a goal before reading full content into context.",
		promptGuidelines: [
			"Use prune_context when a large file or small candidate set needs task-aware pruning before deeper reading.",
			"Pass a local file, directory, glob, or array of those as input; the router reads files locally and delegates pruning to the configured provider.",
		],
		parameters: Type.Object({
			goal: Type.String({ description: "Natural-language goal describing what to preserve." }),
			input: Type.Union([Type.String(), Type.Array(Type.String())], {
				description: "Local file, directory, glob, or array of local files/directories/globs.",
			}),
			baseDir: Type.Optional(Type.String({ description: "Base directory for resolving relative inputs. Defaults to the current workspace." })),
			provider: Type.Optional(Type.String({ description: "Optional provider name, e.g. swe-pruner." })),
			threshold: Type.Optional(Type.Number({ default: 0.5, description: "Provider-specific relevance threshold. Lower keeps more." })),
			maxFiles: Type.Optional(Type.Number({ default: 50, description: "Maximum files expanded from directories/globs." })),
			maxFileBytes: Type.Optional(Type.Number({ default: 500_000, description: "Skip files larger than this many bytes." })),
			lineNumbers: Type.Optional(Type.Boolean({ default: true, description: "Include line-number prefixes in output when supported." })),
			timeoutMs: Type.Optional(Type.Number({ default: 60_000, description: "Prune provider timeout in milliseconds." })),
		}),
		prepareArguments(args): PruneContextParams {
			if (!args || typeof args !== "object") return args as PruneContextParams;
			const input = args as Record<string, unknown>;
			if (input.input === undefined) {
				if (typeof input.path === "string") return { ...input, input: input.path, goal: input.goal ?? input.query } as PruneContextParams;
				if (Array.isArray(input.paths)) return { ...input, input: input.paths, goal: input.goal ?? input.query } as PruneContextParams;
			}
			if (input.goal === undefined && typeof input.query === "string") return { ...input, goal: input.query } as PruneContextParams;
			return args as PruneContextParams;
		},
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const documents = await expandLocalInput(params.input, {
				baseDir: params.baseDir ?? ctx.cwd,
				maxFiles: params.maxFiles,
				maxFileBytes: params.maxFileBytes,
			});
			if (documents.length === 0) {
				throw new Error(`No readable text files matched input: ${JSON.stringify(params.input)}`);
			}
			const request: PruneRequest = {
				goal: params.goal,
				input: documents,
				options: {
					provider: params.provider,
					threshold: params.threshold,
					lineNumbers: params.lineNumbers ?? true,
					timeoutMs: params.timeoutMs,
				},
				metadata: {
					caller: "prune_context",
					cwd: ctx.cwd,
					expandedPaths: documents.map((document) => document.source ?? document.id),
				},
			};

			const result = await router.prune(request, signal);
			return {
				content: [{ type: "text", text: result.text }],
				details: {
					...result,
					expandedPaths: documents.map((document) => document.source ?? document.id),
				},
			};
		},
	});
}

export * from "./types";
export { PruneRouter } from "./router";
