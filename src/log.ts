import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LOG_PATH = join(homedir(), ".pi", "log", "prune-router.jsonl");

export function logDiagnostic(message: string, error?: unknown): void {
	try {
		mkdirSync(dirname(LOG_PATH), { recursive: true });
		appendFileSync(LOG_PATH, `${JSON.stringify({ ts: new Date().toISOString(), message, error: formatError(error) })}\n`, "utf8");
	} catch {
		// Diagnostics must never break pruning.
	}
}

function formatError(error: unknown): Record<string, string> | string | undefined {
	if (error === undefined) return undefined;
	if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack ?? "" };
	return String(error);
}
