# Prework 02 — Project-scope PDF security

Baseline: `e6532fc37ec6ca3354fac7aeb4402269cb726edb`

Scope: API/report authorization only

Database/schema/deployment: unchanged

## Result

- Submittal Report PDF requires the established authentication middleware and
  current-project membership middleware.
- Clash Report PDF requires the same established gates.
- Project report PDF routes no longer accept bearer/JWT material through the
  query string.
- Existing proof callers send the bearer credential through the Authorization
  header.
- Focused behavior verifies authorized membership, the existing verified
  super-administrator path, non-member rejection, and query-only-token
  rejection.

## Verification

- `pnpm --filter @workspace/api-server run test:pdf-route-authorization` — PASS
  with inert local-only environment values; no database connection occurred.
- `pnpm run typecheck` — PASS after building workspace declarations.
- Tracked-secret exposure, database-source safety and mojibake checks — PASS as
  part of the full build gate.

```text
PREWORK=02
RESULT=PASS
SUBMITTAL_PDF_AUTH_FIX=PASS
CLASH_PDF_AUTH_FIX=PASS
QUERY_TOKEN_REMOVAL=PASS FOR PROJECT PDF DOWNLOAD ROUTES
CROSS_PROJECT_DOWNLOAD_TEST=PASS THROUGH ESTABLISHED MEMBERSHIP MIDDLEWARE BEHAVIOR
AUTHORIZED_DOWNLOAD_TEST=PASS
DATABASE_CHANGED=NO
SCHEMA_CHANGED=NO
DEPLOYMENT_CHANGED=NO
```
