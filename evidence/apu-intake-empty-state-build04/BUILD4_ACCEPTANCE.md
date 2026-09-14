# Build 4 — Intake prerequisite guidance and preserved navigation

- Parent commit: `eb2e8f3b130d2450efd7223630fa63bf98647855`
- Scope: production Job Intake UI only
- Version: `v1.05.N17-P18` (unchanged)
- Database/schema: unchanged
- Lens Next/Native: unchanged
- Publication/deployment: not performed

## Accepted behavior

- Empty saved-APU state says that the saved version is optional and that the editable unit rate remains valid.
- Empty approved-budget state says that the budget link is optional and Intake may continue without it.
- Empty selectors with no selectable option are not shown.
- Existing saved APU versions, approved snapshots, and budget lines remain selectable when present.
- `Open Cost & Value Planner` routes to `/projects/:id/financial/apu`.
- `Open Project Budget` routes to `/projects/:id/financial/budget`.
- Before either route change, the production workspace preserves the `scope` stage, Advanced mode, current revision, and current draft in project-specific local recovery storage.

## Proof

- `ContractItemBulkEditor.behavior.tsx`: PASS using the actual production component rendered with empty and populated data.
- Chrome production-component harness: PASS. Both optional empty states were visible; both prerequisite controls were enabled; the observable workspace changed to Cost & Value Planner and Project Budget respectively.
- Job Intake regression: PASS.
- Generic APU regression: PASS, including Build 3 optional-link rules and all existing APU/Job Intake integrations.
- BIMLog frontend typecheck: PASS.
- API typecheck: PASS.
- Frontend production build and artifact verification: PASS.

## Boundaries

- No APU calculation, rate, saved-version, budget-binding, activation, database, schema, or entitlement semantics changed in this build.
- The harness imports the actual production `ContractItemBulkEditor`; it does not duplicate production behavior.
