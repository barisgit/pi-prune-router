import type {
	NormalizedPruneRequest,
	PruneProviderRegistration,
	PruneRequest,
	PruneResult,
} from "./types";
import { savePruneArtifact } from "./artifacts";
import { logDiagnostic } from "./log";
import { normalizePruneRequest } from "./normalize";

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

	listProviders(): Array<Omit<RegisteredProvider, "prune">> {
		return [...this.providers.values()]
			.sort(compareProviders)
			.map(({ prune: _prune, ...provider }) => provider);
	}

	async prune(request: PruneRequest, signal?: AbortSignal): Promise<PruneResult> {
		const normalized = normalizePruneRequest(request);
		normalized.artifact = await savePruneArtifact(normalized);

		const provider = this.selectProvider(normalized);
		logDiagnostic(
			`[pi-prune-router] prune request documents=${normalized.documents.length} requestedProvider=${normalized.options?.provider ?? "<auto>"} availableProviders=${[...this.providers.keys()].join(",") || "<none>"} selectedProvider=${provider?.name ?? "<none>"}`,
		);
		if (!provider) {
			throw pruneFailure(normalized, "No prune provider registered.");
		}

		try {
			const result = await withTimeout(
				provider.prune(normalized, signal),
				normalized.options?.timeoutMs ?? 60_000,
				signal,
			);
			return {
				...result,
				provider: result.provider ?? provider.name,
				artifact: result.artifact ?? normalized.artifact,
				text: renderWithArtifact(result.text, normalized.artifact.path),
			};
		} catch (error) {
			const reason = `Provider ${provider.name} failed: ${error instanceof Error ? error.message : String(error)}`;
			throw pruneFailure(normalized, reason);
		}
	}

	private selectProvider(request: NormalizedPruneRequest): RegisteredProvider | undefined {
		const requested = request.options?.provider;
		if (requested) return this.providers.get(requested);
		return [...this.providers.values()].sort(compareProviders)[0];
	}
}

function compareProviders(a: RegisteredProvider, b: RegisteredProvider): number {
	return (b.priority ?? 0) - (a.priority ?? 0) || a.registeredAt - b.registeredAt || a.name.localeCompare(b.name);
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
