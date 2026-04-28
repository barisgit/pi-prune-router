# SPEC: Pi Prune Router

`pi-prune-router` owns the neutral pruning service for Pi. It exposes a shared context-pruning contract to Pi surfaces and extensions, saves raw inputs as artifacts, selects registered providers, handles fallback, and renders pruned output.

Event namespace:

- `prune:register-provider`
- `prune:request`

It is provider-agnostic. It must not contain SWE-Pruner-specific code.
