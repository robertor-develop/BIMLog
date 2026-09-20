# Build 097 — Runtime performance and cache coherence

- Dashboard briefing cache lifetime is reduced from one hour to 30 seconds.
- Cache identity includes the authenticated user and exact authorized project membership set.
- Concurrent requests for the same scope share one in-flight loader; membership changes select a different key.
- Cache memory is bounded and expiration is deterministic.
- Focused contract test: `pnpm --filter @workspace/api-server run test:block20-build097`.
