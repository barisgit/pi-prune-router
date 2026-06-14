# pi-prune-router

Provider-agnostic pruning router/service extension for Pi.

`pi-prune-router` owns the shared pruning API/event contract, artifact lifecycle, and provider selection. It does **not** implement a model strategy and does **not** expose a public tool. Providers such as `pi-prune-swe-pruner-provider` register with it; Pi tools/extensions drive pruning through the internal `prune:request` event.

## Internal event contract

### Provider registration

Providers register themselves with the router:

```ts
pi.events.emit("prune:register-provider", {
  name: "swe-pruner",
  priority: 100,
  capabilities: { multiDocument: true, lineSpans: true, scores: true },
  prune: async (request, signal) => result,
});
```

### Prune request

Pi tools/extensions that already have content can call the internal prune bus:

```ts
pi.events.emit("prune:request", {
  request: {
    goal: "Keep failing tests, assertion errors, stack traces, and relevant source paths",
    input: [{ source: "test.log", text: "large already-selected text" }],
    budget: { tokens: 4000 },
  },
  resolve,
  reject,
});
```

This internal event accepts already-selected documents. It is for tools such as `fetch`, `bash`, web search, MCP adapters, and future DCP/context flows.

## Responsibilities

- normalize internal prune requests
- save full raw input artifacts under `~/.pi/prune-artifacts`
- clean old artifacts using `PI_PRUNE_ARTIFACT_RETENTION_DAYS` (default: `7`)
- select a registered provider by explicit name or priority
- enforce provider timeouts/failure handling
- never return raw unpruned fallback content when a provider is missing or failed
- render pruned text plus artifact reference

## Artifact storage

Default artifact root:

```text
~/.pi/prune-artifacts
```

Override:

```bash
export PI_PRUNE_ARTIFACT_DIR=/some/other/path
```

Retention:

```bash
export PI_PRUNE_ARTIFACT_RETENTION_DAYS=7
```

Set retention to `0` or a negative value to disable cleanup.

Artifact directories are date-based:

```text
~/.pi/prune-artifacts/YYYY-MM-DD/<timestamp-id>.txt
~/.pi/prune-artifacts/YYYY-MM-DD/<timestamp-id>.json
```

## Creating a new prune provider

A new provider should be a separate Pi extension package. The router stays provider-agnostic.

Minimum provider checklist:

1. Add a Pi extension entrypoint.
2. Implement a `prune(request, signal)` function that accepts a normalized prune request.
3. Register with:

   ```ts
   pi.events.emit("prune:register-provider", {
     name: "my-provider",
     priority: 50,
     capabilities: { multiDocument: true },
     prune,
   });
   ```

4. Return a `PruneResult` with plain `text` and optional `documents`, `stats`, `warnings`, and `provider`.
5. Re-register on `session_start` so reloads/new sessions pick up the provider.
6. Add the provider package to `~/.pi/agent/settings.json`.
7. Test by emitting a `prune:request` event with a small already-selected document.

Provider implementations may call a remote HTTP/GPU backend, a local process, a SaaS reranker, or a pure heuristic implementation. The router API is the same.

## Smoke test

After installing a provider and reloading Pi, emit a `prune:request` with a small document and confirm the result contains:

- plain text
- `# <source>` document headings
- score/token metadata when the provider supports it
- `NNN | code` line numbers when `lineNumbers` is true
- a full-input artifact reference at the bottom
