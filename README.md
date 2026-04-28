# pi-prune-router

Provider-agnostic pruning router/service extension for Pi.

`pi-prune-router` owns the shared pruning API/event contract and the public `prune_context` tool. It does **not** implement a model strategy. Providers such as `pi-prune-swe-pruner-provider` register with it.

## Public tool

`prune_context` accepts local filesystem inputs only:

```json
{
  "goal": "Find workflow runtime and scheduler logic",
  "input": "/path/to/repo/src",
  "threshold": 0.5,
  "maxFiles": 50,
  "maxFileBytes": 500000,
  "lineNumbers": true
}
```

`input` may be a file, directory, glob, or array of those. The router reads local files, saves the raw input as artifacts, delegates model pruning to a registered provider, and returns plain text with real newlines.

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

Internal prune request:

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

The internal event can accept already-selected documents. The public tool intentionally does not; if an agent has to manually pass content, the tool ergonomics are wrong.

## Responsibilities

- expose `prune_context`
- expand local files/directories/globs into documents
- normalize internal prune requests
- save full raw input artifacts under `~/.pi/agent/prune-artifacts`
- select a registered provider by name or priority
- handle provider timeout/fallback
- render pruned text plus artifact reference
