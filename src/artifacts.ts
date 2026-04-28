import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NormalizedPruneRequest, PruneArtifact } from "./types";

const DEFAULT_ARTIFACT_ROOT = join(homedir(), ".pi", "agent", "prune-artifacts");

export async function savePruneArtifact(
	request: NormalizedPruneRequest,
	options: { root?: string; now?: Date } = {},
): Promise<PruneArtifact> {
	const now = options.now ?? new Date();
	const day = now.toISOString().slice(0, 10);
	const id = `${now.toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
	const root = options.root ?? process.env.PI_PRUNE_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_ROOT;
	const dir = join(root, day);
	await mkdir(dir, { recursive: true });

	const content = renderArtifactText(request);
	const path = join(dir, `${id}.txt`);
	const metadataPath = join(dir, `${id}.json`);
	await writeFile(path, content, "utf8");
	await writeFile(metadataPath, JSON.stringify(renderArtifactMetadata(request, path), null, 2), "utf8");

	return {
		path,
		metadataPath,
		bytes: Buffer.byteLength(content),
		documentCount: request.documents.length,
	};
}

function renderArtifactText(request: NormalizedPruneRequest): string {
	const parts = [
		`# Pi prune artifact`,
		`goal: ${request.goal}`,
		`documents: ${request.documents.length}`,
		"",
	];
	for (const document of request.documents) {
		parts.push(`--- ${document.source ?? document.id ?? "document"} ---`);
		parts.push(document.text);
		parts.push("");
	}
	return parts.join("\n");
}

function renderArtifactMetadata(request: NormalizedPruneRequest, textPath: string): Record<string, unknown> {
	return {
		textPath,
		goal: request.goal,
		preserve: request.preserve,
		budget: request.budget,
		metadata: request.metadata,
		options: request.options,
		documents: request.documents.map((document) => ({
			id: document.id,
			source: document.source,
			bytes: Buffer.byteLength(document.text),
			hints: document.hints,
			metadata: document.metadata,
		})),
	};
}
