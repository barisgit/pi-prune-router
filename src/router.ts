import { formatSize, truncateHead } from "@mariozechner/pi-coding-agent";
import type {
	NormalizedPruneRequest,
	PruneProviderRegistration,
	PruneRequest,
	PruneResult,
} from "./types";
import { savePruneArtifact } from "./artifacts";
import { logDiagnostic } from "./log";
import { normalizePruneRequest } from "./normalize";

export const PRUNE_OUTPUT_MAX_BYTES = 20 * 1024;
export const PRUNE_OUTPUT_MAX_LINES = 1000;

interface RegisteredProvider extends PruneProviderRegistration {
	registeredAt: number;
}

export class PruneRouter {
	private readonly providers = new Map<string, RegisteredProvider>();

	registerProvider(provider: PruneProviderRegistration): void {
		if (!provider.name?.trim()) throw new Error("prune provider requires a name");
		if (typeof provider.prune !== "function") throw new Error(`prune provider ${provider.name} requires a prune function`);
		this.providers.set(provider.name, {
			...provider,
			priority: provider.priority ?? 0,
			registeredAt: Date.now(),
		});
		logDiagnostic(`[pi-prune-router] registered provider name=${provider.name} priority=${provider.priority ?? 0}`);
	}

	unregisterProvider(name: string): void {
		if (this.providers.delete(name)) {
			logDiagnostic(`[pi-prune-router] unregistered provider name=${name}`);
		}
	}

	listProviders(): Array<Omit<RegisteredProvider, "prune">> {
		return [...this.providers.values()]
			.sort(compareProviders)
			.map(({ prune: _prune, ...provider }) => provider);
	}

	async prune(request: PruneRequest, signal?: AbortSignal): Promise<PruneResult> {
		const normalized = normalizePruneRequest(request);
		normalized.artifact = await savePruneArtifact(normalized);

		const providers = this.selectProviders(normalized);
		logDiagnostic(
			`[pi-prune-router] prune request documents=${normalized.documents.length} requestedProvider=${normalized.options?.provider ?? "<auto>"} availableProviders=${[...this.providers.keys()].join(",") || "<none>"} selectedProviders=${providers.map((provider) => provider.name).join(",") || "<none>"}`,
		);
		if (providers.length === 0) {
			const requested = normalized.options?.provider;
			throw pruneFailure(normalized, requested ? `Requested prune provider not registered: ${requested}.` : "No prune provider registered.");
		}

		const failures: string[] = [];
		for (const provider of providers) {
			try {
				const result = await withTimeout(
					provider.prune(normalized, signal),
					normalized.options?.timeoutMs ?? 60_000,
					signal,
				);
				const capped = capProviderOutput(result.text, normalized.artifact.path);
				return {
					...result,
					provider: result.provider ?? provider.name,
					artifact: result.artifact ?? normalized.artifact,
					text: capped.text,
					truncation: capped.truncation,
				};
			} catch (error) {
				const reason = `Provider ${provider.name} failed: ${error instanceof Error ? error.message : String(error)}`;
				failures.push(reason);
				logDiagnostic(`[pi-prune-router] ${reason}`);
				if (normalized.options?.provider) break;
			}
		}

		throw pruneFailure(normalized, failures.join("; "));
	}

	private selectProviders(request: NormalizedPruneRequest): RegisteredProvider[] {
		const requested = request.options?.provider;
		if (requested) {
			const provider = this.providers.get(requested);
			return provider ? [provider] : [];
		}
		return [...this.providers.values()].sort(compareProviders);
	}
}

function compareProviders(a: RegisteredProvider, b: RegisteredProvider): number {
	return (b.priority ?? 0) - (a.priority ?? 0) || a.registeredAt - b.registeredAt || a.name.localeCompare(b.name);
}

function capProviderOutput(text: string, artifactPath: string): Pick<PruneResult, "text" | "truncation"> {
	const truncation = truncateHead(text, {
		maxBytes: PRUNE_OUTPUT_MAX_BYTES,
		maxLines: PRUNE_OUTPUT_MAX_LINES,
	});
	if (!truncation.truncated) {
		return { text: renderWithArtifact(text, artifactPath) };
	}

	const cappedText = truncation.firstLineExceedsLimit
		? `[Pruned output omitted: first line exceeds ${formatSize(truncation.maxBytes)} limit. Full unpruned input saved at: ${artifactPath}]`
		: `${truncation.content.trimEnd()}\n\n${formatPrunedOutputTruncationNotice(truncation, artifactPath)}`;
	return {
		text: cappedText,
		truncation,
	};
}

function formatPrunedOutputTruncationNotice(truncation: NonNullable<PruneResult["truncation"]>, artifactPath: string): string {
	if (truncation.truncatedBy === "lines") {
		return `[Pruned output truncated: showing lines 1-${truncation.outputLines} of ${truncation.totalLines}. Full unpruned input saved at: ${artifactPath}]`;
	}
	return `[Pruned output truncated: showing lines 1-${truncation.outputLines} of ${truncation.totalLines} (${formatSize(truncation.maxBytes)} limit). Full unpruned input saved at: ${artifactPath}]`;
}

function renderWithArtifact(text: string, artifactPath: string): string {
	const trimmed = text.trimEnd();
	return `${trimmed}\n\n[Full unpruned input saved at: ${artifactPath}]`;
}

function pruneFailure(request: NormalizedPruneRequest, reason: string): Error {
	const artifactPath = request.artifact?.path ?? "<artifact unavailable>";
	const message = `${reason} No provider-pruned output was returned. Full unpruned input saved at: ${artifactPath}`;
	logDiagnostic(`[pi-prune-router] prune failed: ${message}`);
	return new Error(message);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
	if (signal?.aborted) throw new Error("prune request aborted");
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timeout = setTimeout(() => reject(new Error(`prune request timed out after ${timeoutMs}ms`)), timeoutMs);
				signal?.addEventListener("abort", () => reject(new Error("prune request aborted")), { once: true });
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}
