import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { expandLocalInput } from "./local-input";
import { logDiagnostic } from "./log";
import { PruneRouter } from "./router";
import {
	PRUNE_REGISTER_PROVIDER_EVENT,
	PRUNE_REQUEST_EVENT,
	type PruneProviderRegistration,
	type PruneRequest,
	type PruneRequestEvent,
} from "./types";

type ScanFilesParams = {
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
		logDiagnostic("[pi-prune-router] received provider registration event");
		try {
			router.registerProvider(payload as PruneProviderRegistration);
		} catch (error) {
			logDiagnostic("[pi-prune-router] failed to register provider", error);
		}
	});

	pi.events.on(PRUNE_REQUEST_EVENT, (payload) => {
		logDiagnostic("[pi-prune-router] received prune request event");
		const event = payload as PruneRequestEvent;
		void router.prune(event.request, event.signal).then(event.resolve, event.reject);
	});

	pi.registerTool({
		name: "scan_files",
		label: "Scan Files",
		description: "Scan local files, directories, or globs with a narrow extraction goal. Returns pruned plain text with real newlines; best results come from goals that say exactly what to keep and what to ignore.",
		promptSnippet: "Scan local files/directories/globs for narrowly specified, goal-relevant context before reading full content.",
		promptGuidelines: [
			"Use scan_files when a large file, directory, glob, or small candidate set needs task-aware pruning before deeper reading.",
			"Write goals as extraction filters, not broad research questions: say 'Keep only ...' or 'Find the exact ...' and include 'Ignore/drop ...' for unrelated content.",
			"If output keeps almost everything (for example ratio > 0.8), retry once with a stricter goal and/or slightly higher threshold instead of reading the full file.",
			"Pass a local file, directory, glob, or array of those as input; the router reads files locally and delegates pruning to the configured provider.",
		],
		parameters: Type.Object({
			goal: Type.String({ description: "Narrow extraction goal describing exact content to keep and, when useful, what to ignore/drop. Prefer 'Keep only...' over broad questions." }),
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
		prepareArguments(args): ScanFilesParams {
			if (!args || typeof args !== "object") return args as ScanFilesParams;
			const input = args as Record<string, unknown>;
			if (input.input === undefined) {
				if (typeof input.path === "string") return { ...input, input: input.path, goal: input.goal ?? input.query } as ScanFilesParams;
				if (Array.isArray(input.paths)) return { ...input, input: input.paths, goal: input.goal ?? input.query } as ScanFilesParams;
			}
			if (input.goal === undefined && typeof input.query === "string") return { ...input, goal: input.query } as ScanFilesParams;
			return args as ScanFilesParams;
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
					caller: "scan_files",
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
