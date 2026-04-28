import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LOG_PATH = join(homedir(), ".pi", "agent", "prune-router.log");

export function logDiagnostic(message: string, error?: unknown): void {
	try {
		mkdirSync(dirname(LOG_PATH), { recursive: true });
		const suffix = error === undefined ? "" : ` ${formatError(error)}`;
		appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}${suffix}\n`, "utf8");
	} catch {
		// Diagnostics must never break pruning.
	}
}

function formatError(error: unknown): string {
	if (error instanceof Error) return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
	return String(error);
}
