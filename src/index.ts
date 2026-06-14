import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { logDiagnostic } from "./log";
import { PruneRouter } from "./router";
import {
	PRUNE_REGISTER_PROVIDER_EVENT,
	PRUNE_UNREGISTER_PROVIDER_EVENT,
	PRUNE_REQUEST_EVENT,
	type PruneProviderRegistration,
	type PruneRequestEvent,
} from "./types";

export default function (pi: ExtensionAPI) {
	const router = new PruneRouter();

	pi.events.on(PRUNE_REGISTER_PROVIDER_EVENT, (payload) => {
		logDiagnostic("[pi-prune-router] received provider registration event");
		try {
			router.registerProvider(payload as PruneProviderRegistration);
		} catch (error) {
			logDiagnostic("[pi-prune-router] failed to register provider", error);
		}
	});

	pi.events.on(PRUNE_UNREGISTER_PROVIDER_EVENT, (payload) => {
		const name = typeof payload === "string" ? payload : (payload as { name?: unknown } | undefined)?.name;
		if (typeof name === "string") router.unregisterProvider(name);
	});

	pi.events.on(PRUNE_REQUEST_EVENT, (payload) => {
		logDiagnostic("[pi-prune-router] received prune request event");
		const event = payload as PruneRequestEvent;
		void router.prune(event.request, event.signal).then(event.resolve, event.reject);
	});
}

export * from "./types";
export { PruneRouter } from "./router";
