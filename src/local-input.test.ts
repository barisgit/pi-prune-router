import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { expandLocalInput } from "./local-input";

describe("expandLocalInput", () => {
	it("reads local files into prune documents", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pi-prune-router-"));
		try {
			const file = join(dir, "demo.ts");
			await writeFile(file, "export const demo = 1;", "utf8");
			const docs = await expandLocalInput(file, { maxFiles: 5 });
			expect(docs).toHaveLength(1);
			expect(docs[0]?.source).toBe(file);
			expect(docs[0]?.text).toContain("demo");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("accepts common documentation and config text extensions", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pi-prune-router-"));
		try {
			const tex = join(dir, "manual.tex");
			const jsonc = join(dir, "settings.jsonc");
			await writeFile(tex, "\\section{Reference}\nGPIO table", "utf8");
			await writeFile(jsonc, "// config\n{ \"enabled\": true }", "utf8");
			const docs = await expandLocalInput([tex, jsonc], { maxFiles: 5 });
			expect(docs.map((doc) => doc.source).sort()).toEqual([jsonc, tex].sort());
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
