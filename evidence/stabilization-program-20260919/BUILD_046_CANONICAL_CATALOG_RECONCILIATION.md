# Build 046 — Canonical catalog reconciliation

- Result: PASS
- Scope: company clients, disciplines, services, phases, aliases, and governed Job Intake selection.
- Added bounded, normalized aliases to company catalog entries without changing canonical IDs, codes, or names.
- Added Service and Phase to the existing governed Job Intake selector alongside Discipline.
- New selections use active canonical values. Existing Intake snapshots continue to retain the exact saved ID/code/name text after later catalog edits or retirement.
- Authority remains Company PMO or Super Administrator with optimistic version checks; read-only users cannot mutate catalogs.
- Database change: additive `aliases jsonb NOT NULL DEFAULT []`; no destructive statement.
- Verification: PMO authority PASS; catalog authority PASS; selector PASS; historical persistence PASS; API TypeScript PASS; web TypeScript PASS.
- Native/installer impact: none.
