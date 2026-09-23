# EDT Engine Block 10 — Builds 321–325

The five bounded commits add read-only server projection of the **already activated** canonical Intake into an EDT plan. They do not open the guarded activation, economic-plan or time-decision mutation routes.

- 321 `6f6c839574368706a24c6234c4b28f34be97f0b2`: load company/project-scoped activated Intake, project identity and saved Work Items.
- 322 `018a3d98e279815a08376089ad0f654758f8973f`: use immutable trade identity for the Work Item code hash and human-readable trade code in its visible segment.
- 323 `efd0a46daed068be3be1d733e3c7491ac9076ca6`: project saved contract profiles, deliverables, floor/zone packages and classifications into deterministic nodes and Work Item codes.
- 324 `3b786365ace358337f7193333e3fb605d22c077f`: exercise normalized multi-contract Intake data, fail closed on missing floor/trade/version and require exact scope coverage.
- 325 `a9bf345986bcae1cb0545b50471105c93b592064`: expose authenticated, company-scoped, read-only `/projects/:projectId/edt-engine/intakes/:intakeId/plan-preview` with rollback and isolation checks.

The preview requires one floor/zone Work Package and a permanent discipline ID/code for each saved Work Item. Existing activated Intake data that lack this structure return an explicit conflict; the service must not invent trade or location identities. Approval still needs pre-activation server-derived versions/plan, and financial/time values need saved-record derivation. This block is not an end-to-end EDT acceptance claim. No Native/installer or database schema changes occurred.

## Publication and corrective live-smoke finding

The full local gate passed; source `b350ab5bbf0a6ce9dcf1155db63dbb5eec8ac786` was pushed, synchronized through Replit Shell and published. Replit's database receipt reported `schemaAction: NONE`, `publishable: true` and `developmentDataCopy: OFF_REQUIRED`; live `/api/v1/healthz` returned the exact source. Authenticated Chrome smoke covered company governance, catalogs, workflows, pricing, project administration, Intake, Operations, Budget, dashboard and Knowledge. The historical QA project has an activated core Intake but lacks the required floor/zone and permanent trade coverage, so it cannot demonstrate a positive EDT preview. This is a fail-closed limitation, not an accepted end-to-end EDT result.

Live finding: on `/company-pricing-templates`, Preview with a blank name displayed raw `PRICING_TEMPLATE_TEXT_INVALID`; its Retry button reloaded the list and could discard the unsaved draft. Corrective source now translates validation to bilingual guidance and shows Retry only for list-load failures. Focused regression and frontend typecheck passed; full re-gate, corrective publication and authenticated Chrome retest are pending.
