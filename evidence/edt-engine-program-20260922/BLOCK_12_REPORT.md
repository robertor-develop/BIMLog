# EDT Engine Block 12 — Builds 331–335

This ten-build publication boundary includes the earlier push-only Block 11. Builds 331–335 harden and expose a read-only activated-Intake EDT preview. No guarded EDT mutation is enabled; no database schema, production data, Lens Next Native or installer files are changed.

- 331 `83a16f8f`: verify each activated Contract/version against canonical company/project Contract records and a retained fingerprint.
- 332 `49545e1b`: verify every activated Work Item has a saved Delivery Workflow binding with an authentic definition fingerprint.
- 333 `a9b8e66c`: verify saved trade IDs against BIMLog defaults or the same company's master disciplines.
- 334 `b3339fa0`: expose the manually requested, read-only EDT plan preview inside Project Operations, with loading/error states and complete-response validation.
- 335 `0facb112`: prove the combined source chain projects only canonical data, rolls back on missing Contract/workflow/trade evidence, and issues no mutation SQL.

Focused Block 12 tests and both API/frontend TypeScript checks passed. Full repository gate, exact remote push, Replit Shell zero-drop publication, live identity and authenticated Chrome smoke are release-boundary steps, not assumed by this report.

This is **not full EDT program acceptance**. Pre-activation plan/version authority, governed activation, economic/time calculation and their operational UI remain open. The original Build 335 target is exhausted; further scope requires evidence-based planning, not a false completion claim.

## Second live-smoke finding

Corrective source `ef9e5d8b0bc8dd559ec2b15b1cf1b738e011bd0e` passed the full local gate, was pushed, passed a clean Replit Shell build and zero-drop preview, and published as deployment `c7f3590f`. Live health matched the exact source. The authenticated Chrome recheck proved the UI no longer displays the first generic string, but the readiness request still returned HTTP 500. Replit production logs identified a wrong PMO table name in `edt-engine-route-context.ts`: `company_master_catalog_admins` instead of the existing `company_master_catalog_administrators`. The request was read-only and changed no records. The lookup and Build 296 regression are corrected locally. A stale Build 300 assertion was also aligned with its current, Intake-joined company-scope query. Block 5 and Block 12 focused tests and API typecheck pass; full gate, corrective push, zero-drop republish and authenticated retest are pending. Do not count either live smoke as passed.

## First publication and corrective smoke finding

The full pre-push gate passed, exact source `cceb5293d181dcde013c06ffcd08e815f3c83bd9` was pushed and built in the clean Replit Shell worktree. Replit database receipt `ab04a21ea3f0964041b8113cbb4c1e980b49b10b18f66ba52c472653bdaa7790` reported both schemas exact, `schemaAction: NONE`, `publishable: true`, development-data copy `OFF_REQUIRED`. Replit deployment `401fd326` completed; live health reported the exact source and `status: ok`.

Authenticated Chrome smoke found a customer-visible defect on the historical QA project `/projects/53/operations`: clicking **Check EDT readiness** returned only “The request failed.” The backend correctly rejects incomplete historical EDT source; Operations discarded its string error and did not translate the stable EDT code into actionable guidance. Hotfix `57186c0f` maps known Contract, location, trade and workflow conflict codes to bilingual, no-mutation guidance and replaces the generic fallback. Focused behavior and frontend typecheck passed. Full re-gate, corrective push, republish and live recheck are still required; the first publication is not accepted as a passing smoke.
