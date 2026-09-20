# Build 106 — Tenant and project object authorization

Status: PASS

- Added one fail-closed object-scope decision contract for API, files, reports, Lens Next, feedback, and integrations.
- Exact company, active-project, requested-project, and object-project identity must agree.
- Cross-tenant requests, guessed project IDs, guessed object IDs, and object/project mismatches are denied.
- Existing route-source checks verify project membership and object/project predicates on file and report paths, plus company/project boundaries for feedback, Lens Next, and integrations.

Regression: `pnpm --filter @workspace/api-server run test:block22-build106`
