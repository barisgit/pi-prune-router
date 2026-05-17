import type { TruncationResult } from "@mariozechner/pi-coding-agent";

export const PRUNE_REGISTER_PROVIDER_EVENT = "prune:register-provider";
export const PRUNE_UNREGISTER_PROVIDER_EVENT = "prune:unregister-provider";
export const PRUNE_REQUEST_EVENT = "prune:request";

export type PrunePrimitive = string | PruneDocument;
export type PruneInput = PrunePrimitive | PrunePrimitive[];

export interface PruneDocument {
	id?: string;
	source?: string;
	text: string;
	hints?: {
		mimeType?: string;
		language?: string;
		lineOffset?: number;
	};
	metadata?: Record<string, unknown>;
}

export interface PruneBudget {
	tokens?: number;
	chars?: number;
	ratio?: number;
}

export interface PruneOptions {
	threshold?: number;
	lineNumbers?: boolean;
	chunkOverlapTokens?: number;
	maxOutputDocuments?: number;
	maxOutputTokensPerDocument?: number;
	includeScores?: boolean;
	includeSpans?: boolean;
	provider?: string;
	timeoutMs?: number;
}

export interface PruneRequest {
	goal: string;
	input: PruneInput;
	preserve?: string[];
	budget?: PruneBudget;
	metadata?: Record<string, unknown>;
	options?: PruneOptions;
}

export interface NormalizedPruneRequest extends Omit<PruneRequest, "input"> {
	documents: PruneDocument[];
	artifact?: PruneArtifact;
}

export interface PruneSpan {
	startLine?: number;
	endLine?: number;
	startChar?: number;
	endChar?: number;
	score?: number;
}

export interface PruneDocumentResult {
	id?: string;
	source?: string;
	text: string;
	score?: number;
	spans?: PruneSpan[];
	stats?: {
		inputTokens?: number;
		outputTokens?: number;
		compressionRatio?: number;
		latencyMs?: number;
	};
}

export interface PruneStats {
	inputTokens?: number;
	outputTokens?: number;
	compressionRatio?: number;
	latencyMs?: number;
	backend?: string;
	model?: string;
	provider?: string;
}

export interface PruneArtifact {
	path: string;
	metadataPath?: string;
	bytes: number;
	documentCount: number;
}

export interface PruneResult {
	text: string;
	documents?: PruneDocumentResult[];
	stats?: PruneStats;
	warnings?: string[];
	artifact?: PruneArtifact;
	provider?: string;
	truncation?: TruncationResult;
}

export interface PruneProviderCapabilities {
	multiDocument?: boolean;
	lineSpans?: boolean;
	scores?: boolean;
	languages?: string[];
	mimeTypes?: string[];
}

export interface PruneProviderRegistration {
	name: string;
	priority?: number;
	capabilities?: PruneProviderCapabilities;
	prune: (request: NormalizedPruneRequest, signal?: AbortSignal) => Promise<PruneResult>;
}

export interface PruneRequestEvent {
	request: PruneRequest;
	resolve: (result: PruneResult) => void;
	reject: (error: unknown) => void;
	signal?: AbortSignal;
}
