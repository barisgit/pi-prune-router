import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PruneRouter } from "./router";

const originalArtifactDir = process.env.PI_PRUNE_ARTIFACT_DIR;

beforeEach(async () => {
	process.env.PI_PRUNE_ARTIFACT_DIR = await mkdtemp(join(tmpdir(), "pi-prune-router-test-"));
});

afterEach(() => {
	if (originalArtifactDir === undefined) delete process.env.PI_PRUNE_ARTIFACT_DIR;
	else process.env.PI_PRUNE_ARTIFACT_DIR = originalArtifactDir;
});

describe("PruneRouter", () => {
	it("falls back to the next provider for automatic selection", async () => {
		const router = new PruneRouter();
		router.registerProvider({
			name: "primary",
			priority: 100,
			prune: async () => { throw new Error("down"); },
		});
		router.registerProvider({
			name: "fallback",
			priority: 10,
			prune: async () => ({ text: "fallback output" }),
		});

		const result = await router.prune({ goal: "keep", input: "raw input" });

		expect(result.provider).toBe("fallback");
		expect(result.text).toContain("fallback output");
		expect(result.text).toContain("Full unpruned input saved at:");
	});

	it("does not fall back when a provider is explicitly requested", async () => {
		const router = new PruneRouter();
		router.registerProvider({
			name: "primary",
			priority: 100,
			prune: async () => { throw new Error("down"); },
		});
		router.registerProvider({
			name: "fallback",
			priority: 10,
			prune: async () => ({ text: "fallback output" }),
		});

		await expect(router.prune({
			goal: "keep",
			input: "raw input",
			options: { provider: "primary" },
		})).rejects.toThrow(/Provider primary failed: down/);
	});

	it("unregisters providers", async () => {
		const router = new PruneRouter();
		router.registerProvider({ name: "gone", prune: async () => ({ text: "gone" }) });
		router.unregisterProvider("gone");

		expect(router.listProviders()).toHaveLength(0);
	});
});
