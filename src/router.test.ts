import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PRUNE_OUTPUT_MAX_BYTES, PRUNE_OUTPUT_MAX_LINES, PruneRouter } from "./router";

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

	it("caps oversized provider output and points to the unpruned input artifact", async () => {
		const router = new PruneRouter();
		const fullOutput = Array.from({ length: PRUNE_OUTPUT_MAX_LINES + 5 }, (_, index) => `line-${index + 1}`).join("\n");
		router.registerProvider({ name: "loud", prune: async () => ({ text: fullOutput }) });

		const result = await router.prune({ goal: "keep", input: "raw input" });

		expect(result.text).toContain("line-1");
		expect(result.text).not.toContain(`line-${PRUNE_OUTPUT_MAX_LINES + 5}`);
		expect(result.text).toContain(`Pruned output truncated: showing lines 1-${PRUNE_OUTPUT_MAX_LINES} of ${PRUNE_OUTPUT_MAX_LINES + 5}`);
		expect(result.truncation?.maxBytes).toBe(PRUNE_OUTPUT_MAX_BYTES);
		expect(result.truncation?.maxLines).toBe(PRUNE_OUTPUT_MAX_LINES);
		expect(result.text).toContain("Full unpruned input saved at:");
		expect(result.text).not.toContain("Full pruned output");
		expect(await readFile(result.artifact!.path, "utf8")).toContain("raw input");
	});

	it("unregisters providers", async () => {
		const router = new PruneRouter();
		router.registerProvider({ name: "gone", prune: async () => ({ text: "gone" }) });
		router.unregisterProvider("gone");

		expect(router.listProviders()).toHaveLength(0);
	});
});
