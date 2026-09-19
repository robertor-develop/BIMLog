# Build 048 — Delivery Workflow template and governance authority

- Result: PASS
- Scope: BIMLog defaults, company definitions, governance policy, and the project Intake selection boundary.
- Company options are loaded only from fingerprint-verified published versions in the active company scope.
- `approved_only` excludes BIMLog defaults; `defaults_allowed` permits defaults only when no matching company definition requires explicit selection.
- Multiple matching company workflows require an explicit choice; an unavailable, cross-scope, wrong-deliverable, unpublished, or stale version cannot reach Intake.
- Template and policy publication retain PMO, Finance maker-checker for economic allocations, overlap, revision, fingerprint, and supersession controls.
- Added a permanent integrated Intake-authority contract test.
- Verification: Delivery Workflow selection PASS; governance-policy contract PASS; integrated Intake authority PASS.
- Database change: none.
- Native/installer impact: none.
