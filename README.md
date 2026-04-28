# pi-prune-router

Provider-agnostic pruning router/service extension for Pi.

`pi-prune-router` owns the shared pruning API/event contract. It does **not** implement a model strategy. Providers such as `pi-prune-swe-pruner-provider` register with it.

## Event contract

Provider registration:

```ts
pi.events.emit("prune:register-provider", {
  name: "swe-pruner",
  priority: 100,
  capabilities: { multiDocument: true, lineSpans: true, scores: true },
  prune: async (request, signal) => result,
});
```

Prune request:

```ts
pi.events.emit("prune:request", {
  request: {
    goal: "Keep failing tests, assertion errors, stack traces, and relevant source paths",
    input: "large already-selected text",
    budget: { tokens: 4000 },
  },
  resolve,
  reject,
});
```

## Responsibilities

- normalize already-selected input into documents
- save full raw input artifacts under `~/.pi/agent/prune-artifacts`
- select a registered provider by name or priority
- handle provider timeout/fallback
- render pruned text plus artifact reference

## Debug tool

The extension also registers `prune_context` for manual testing. It expects already-selected text/documents, not filesystem paths.
