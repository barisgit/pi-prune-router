# pi-prune-router

Provider-agnostic pruning router/service extension for Pi.

Owns the shared `context.prune(...)`-style API/event contract, artifact handling, provider registration, provider selection, fallback, and rendering.

Providers such as `pi-prune-swe-pruner-provider` register with this router.
