# Build 099 — Restart, interruption, and resume resilience

- Reads and unacknowledged idempotent writes may retry with bounded exponential delay.
- Acknowledged operations resume without duplicate mutation.
- Non-idempotent partial writes and invalid sessions fail closed.
- The permanent suite also runs deployment-module stale-asset recovery and session-continuity regressions, including stale response rejection.
- Aggregate command: `pnpm --filter @workspace/api-server run test:block20-build099`.
