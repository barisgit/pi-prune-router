import { describe, expect, it } from "bun:test";
import { normalizePruneRequest } from "./normalize";

describe("normalizePruneRequest", () => {
	it("normalizes string input into a document", () => {
		const request = normalizePruneRequest({ goal: "keep auth logic", input: "const x = 1;" });
		expect(request.documents).toHaveLength(1);
		expect(request.documents[0]?.text).toBe("const x = 1;");
	});

	it("rejects empty goals", () => {
		expect(() => normalizePruneRequest({ goal: " ", input: "text" })).toThrow(/goal/);
	});
});
