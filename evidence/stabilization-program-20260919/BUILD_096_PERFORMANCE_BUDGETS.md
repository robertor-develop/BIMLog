# Build 096 — Performance budgets

- The existing production-artifact startup requirement remains fail-closed at 8,000 ms on Windows.
- API health p95 is bounded at 1,000 ms under the exact-artifact concurrent probe.
- Browser JavaScript is measured after every production build: largest asset at most 750 KiB and aggregate JavaScript at most 4 MiB.
- Existing Lens payload and report-generation ceilings are represented in one typed budget contract.
- Focused contract test: `pnpm --filter @workspace/api-server run test:block20-build096`.
