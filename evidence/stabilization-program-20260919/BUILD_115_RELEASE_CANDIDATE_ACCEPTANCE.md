# Build 115 — Frozen full-system release candidate

Status: `PASS_PENDING_PUSH`

- Builds 111–115 are bound into the normal pre-push gate.
- Clean-install automation, exact packaged-artifact proof, complete authenticated desktop route coverage, desktop/tablet/exact-390 review, accessibility/keyboard/theme/language checks, dual-year Native contract tests, exact package hashes, and package-only installer migration/rollback simulations pass.
- Release-blocking product findings: `P0=0`, `P1=0`.
- Truthful residual limitation: this workstation cannot supply final real-model Navisworks 2021/2025 acceptance. Live 2021 still contains historical installation state and Navisworks 2025 is absent. This remains an explicit Build 119 final-release gate and is not silently waived.
- The candidate changes no production database/schema, customer data, provider binding, Native implementation, installer implementation, or deployed package. Production remains the accepted P36 publication.
- Build 115 is push-only. No Replit publication or production mutation is authorized or due until Build 120.

Aggregate regression: `pnpm --filter @workspace/api-server run test:block23-full-system-acceptance`

