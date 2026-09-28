# C111 — Clean-install acceptance

- Candidate: `04aef8d44bb5e249ef5fd37ca0f2507cc1c44bd4`
- Toolchain: pnpm `11.17.0`
- Command: `pnpm install --frozen-lockfile`
- Result: PASS; the lockfile passed supply-chain policy and the workspace was already exact.
- Contract: `pnpm --filter @workspace/api-server run test:block23-build111`
- Contract result: PASS.
- Unexplained skips, retries, or stale fixtures: none.
- Production, customer data, database/schema, Native installation and provider state: unchanged.
