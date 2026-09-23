# EDT Engine Block 10 — Builds 321–325

The five bounded commits add read-only server projection of the **already activated** canonical Intake into an EDT plan. They do not open the guarded activation, economic-plan or time-decision mutation routes.

- 321 `6f6c839574368706a24c6234c4b28f34be97f0b2`: load company/project-scoped activated Intake, project identity and saved Work Items.
- 322 `018a3d98e279815a08376089ad0f654758f8973f`: use immutable trade identity for the Work Item code hash and human-readable trade code in its visible segment.
- 323 `efd0a46daed068be3be1d733e3c7491ac9076ca6`: project saved contract profiles, deliverables, floor/zone packages and classifications into deterministic nodes and Work Item codes.
- 324 `3b786365ace358337f7193333e3fb605d22c077f`: exercise normalized multi-contract Intake data, fail closed on missing floor/trade/version and require exact scope coverage.
- 325 `a9bf345986bcae1cb0545b50471105c93b592064`: expose authenticated, company-scoped, read-only `/projects/:projectId/edt-engine/intakes/:intakeId/plan-preview` with rollback and isolation checks.

The preview requires one floor/zone Work Package and a permanent discipline ID/code for each saved Work Item. Existing activated Intake data that lack this structure return an explicit conflict; the service must not invent trade or location identities. Approval still needs pre-activation server-derived versions/plan, and financial/time values need saved-record derivation. This block is not an end-to-end EDT acceptance claim. No Native/installer or database schema changes occurred.
