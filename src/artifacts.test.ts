import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { savePruneArtifact } from "./artifacts";
import type { NormalizedPruneRequest } from "./types";

const originalRetention = process.env.PI_PRUNE_ARTIFACT_RETENTION_DAYS;

afterEach(() => {
	if (originalRetention === undefined) delete process.env.PI_PRUNE_ARTIFACT_RETENTION_DAYS;
	else process.env.PI_PRUNE_ARTIFACT_RETENTION_DAYS = originalRetention;
});

function request(): NormalizedPruneRequest {
	return {
		goal: "keep auth logic",
		documents: [{ id: "a", source: "a.ts", text: "const x = 1;" }],
		options: {},
	};
}

describe("savePruneArtifact", () => {
	it("writes artifacts under the configured root", async () => {
		const root = await mkdtemp(join(tmpdir(), "pi-prune-artifacts-"));
		const artifact = await savePruneArtifact(request(), { root, now: new Date("2026-04-29T12:00:00.000Z") });

		expect(artifact.path.startsWith(join(root, "2026-04-29"))).toBe(true);
		expect(artifact.metadataPath?.startsWith(join(root, "2026-04-29"))).toBe(true);
	});

	it("removes dated artifact directories older than retention", async () => {
		process.env.PI_PRUNE_ARTIFACT_RETENTION_DAYS = "7";
		const root = await mkdtemp(join(tmpdir(), "pi-prune-artifacts-"));
		await savePruneArtifact(request(), { root, now: new Date("2026-04-01T12:00:00.000Z") });
		await savePruneArtifact(request(), { root, now: new Date("2026-04-29T12:00:00.000Z") });

		const entries = await readdir(root);
		expect(entries).not.toContain("2026-04-01");
		expect(entries).toContain("2026-04-29");
	});
});
