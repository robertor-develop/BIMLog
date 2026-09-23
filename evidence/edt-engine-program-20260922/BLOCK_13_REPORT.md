# EDT Engine Block 13 — Builds 336–340

## Release boundary inherited from Block 12

The prior read-only EDT readiness defect was corrected and pushed at exact source `bd3be0742d702ba7d186d6a47b87830b526a183b`. Replit Shell aligned to that commit, built it cleanly, and produced database receipt `49fb581622202fbb8eac9f8bf1d2cf7a1b7739d88a124c162447f12bce2b7593`: `schemaAction=NONE`, `publishable=true`, development-data copy `OFF_REQUIRED`. Replit published successfully; live `/api/v1/healthz` returned `status=ok` and the exact source commit. In an authenticated Chrome session, Job Operations on historical project 53 returned the expected governed Contract-source conflict rather than HTTP 500, including after reload/retry. Headquarters, company catalogs, workflows, governance, pricing validation, Intake, Operations, Budget, Contracts and Knowledge were navigated without a new visible crash. This is a broad release regression, not proof of every platform workflow or positive EDT activation.

## Five bounded builds

| Build | Commit | Accepted scope |
| --- | --- | --- |
| 336 | `c50b18d5` | Return already-verified immutable Contract and Workflow binding identities from the activated source loader. |
| 337 | `9e7cb930` | Derive a deterministic read-only EDT activation candidate exclusively from activated Intake, canonical Contracts, frozen Workflows and saved Governance; reject missing bindings. |
| 338 | `fbc0ed55` | Expose a company/project-scoped authenticated read-only activation-candidate endpoint; register it in the endpoint authority inventory. |
| 339 | `d11357c3` | Connect Operations readiness to the server-owned candidate, validate response integrity, and state explicitly that governed EDT activation remains disabled. |
| 340 | pending | Consolidate positive/negative candidate, real-schema SQL, UI and still-guarded mutation regressions in an executable block gate. |

The candidate uses stable snapshot fingerprints as internal identities. It **does not** approve or activate EDT, allocate funds, transition hours, create Work Items or replace the canonical Commercial APU. The four guarded mutation routes remain closed. No database migration, customer data change, Lens Next Native file or installer change occurs in this block. Block 13 is push-only; the next publication is due after a second five-build block, with zero-drop preview and full authenticated Chrome smoke then. Positive activation, economic/time authority, and complete Intake/Operations UI remain open and must not be reported complete.

Block gate: `pnpm run test:edt-engine-block13` with the isolated PostgreSQL URL, API and frontend typechecks, full exact-head pre-push gate, clean source commit and exact GitHub push. Pending gates must be updated with observed evidence, not assumed.
