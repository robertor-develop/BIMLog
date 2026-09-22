# Build 278 — existing capability and delta inventory

Date: 2026-09-22  
Baseline inspected: `c33570ca36ea7c0574dac5b98cc88bc33dfb1d7f`  
Result: `PASS_DELTA_CLASSIFIED`

This inventory is based on current production source, not on screenshots or the historical MAIN00
handoff. `COMPLETE` means reusable authority exists for the EDT program. `PARTIAL` means a real
implementation exists but does not satisfy the approved v1.2 behavior. `MISSING` means no canonical
implementation matching the requirement was found.

## Reusable existing capability

| Capability | State | Current source authority | EDT-program disposition |
|---|---|---|---|
| Company-scoped Clients, Disciplines, Services and Phases | COMPLETE foundation | `routes/company-master-catalogs.ts`, `CompanyMasterCatalogsTab.tsx` | Extend lifecycle/usage proof only; do not create another catalog. |
| Delivery Workflow definitions and version records | COMPLETE foundation | `delivery-workflow-template-migration.ts`, workflow contract/routes/UI | Extend the existing definition and editor; do not create a second workflow engine. |
| Workflow phases, tasks, transitions, roles and gates | PARTIAL | `CompanyDeliveryWorkflowsTab.tsx`, `delivery-workflow-runtime.ts` | Add approved criteria/documents/approval behavior and finish the governed UX. |
| Workflow economic-allocation preview | COMPLETE foundation | `delivery-workflow-economic-allocation.ts` | Reuse all four allocation methods and connect them to the frozen Work Item Economic Plan. |
| Workflow runtime snapshot, role assignment, evidence, phase approval/advance/reopen | COMPLETE foundation | `delivery-workflow-runtime.ts` and existing workflow runtime tables | Extend instead of replacing. Preserve existing snapshots/events. |
| Governance Policy definition/version lifecycle | COMPLETE foundation | `workflow-governance-policy-*`, `CompanyWorkflowGovernance.tsx` | Reuse policy identity/version/history. |
| Governance rules enforced on operational records | PARTIAL | UI explicitly states policy rows are recorded intent, not execution permissions | Build backend action/eligibility enforcement; do not report the current editor as full governance. |
| Company APU/Pricing template lifecycle and contract binding | COMPLETE foundation | `CompanyPricingTemplates.tsx`, `company-pricing-template-binding.ts` | Keep Commercial canonical and extend economic pool/snapshot behavior. |
| Intake draft, documents, mappings and activation | COMPLETE foundation | `job-intake-service.ts`, `job-intake-migration.ts`, `JobIntakeWorkspace.tsx` | Extend transactional activation to the approved EDT/snapshot chain. |
| Activation Work Items, tasks, assignments, packages, baselines and events | COMPLETE foundation | existing `job_activation_*` tables | Migrate/extend in place; do not create a parallel job runtime. |
| Task status/progress, assignment, hours, deliverables and document connections | COMPLETE foundation | `job-operations-service.ts`, `JobOperationsWorkspace.tsx` | Extend states, approvals and canonical EDT relationships. |
| Schedule bucket/Sprint board and rollover | COMPLETE authority | `routes/schedule.ts`, `ScheduleTab.tsx` | Integrate Work Items/tasks with this authority; never create a duplicate Sprint engine. |
| Change Order identity, lifecycle, financial behavior and UI | COMPLETE foundation | `routes/change_orders.ts`, existing behavior suites and `ChangeOrdersTab.tsx` | Extend threshold/baseline integration rather than replacing the module. |
| Budget baselines, accounts, forecasts and variance review | COMPLETE foundation | `job-intake-migration.ts`, `job-operations-service.ts`, financial services | Extend ledger states and protected pools. |

## Proven gaps to implement

| Approved outcome | Current state | Required delta |
|---|---|---|
| Complete Headquarters list/detail/editor lifecycle | PARTIAL | Current workflow/catalog screenshots show sparse creation shells; complete reopen, review, approve, activate, supersede, usage and history UX. |
| Granular engine permission vocabulary and record eligibility | MISSING | Add the approved permission codes, company/project scope, exact-record eligibility and anti-self-approval. |
| Project → Contract → Deliverable → Floor/Area canonical EDT | PARTIAL | Existing activation rows lack the approved explicit hierarchy and identity semantics. |
| Work Item Location + Trade + Deliverable identity, UUID, deterministic code and alias correction | PARTIAL | Preserve current UUID records while adding deterministic visible identity and governed correction history. |
| Immutable Governance + Contract APU + Workflow activation chain | PARTIAL | Workflow/policy snapshots exist, but project/contract/work-item resolution and activation approvals are not the complete approved chain. |
| Project Leader request and Operations Director activation approval | MISSING | Add request/review/decision state and backend eligibility. |
| Frozen Work Item Economic Plan | PARTIAL | Allocation preview/bindings exist; create the immutable resolved plan at activation. |
| Budgeted / Committed-Pending / Approved-Consumed / Available | MISSING | Extend time and budget ledgers so pending entries immediately reserve availability. |
| Protected Direct Production and Project Administrative Labor | PARTIAL | Current financial foundations do not enforce the approved non-transfer boundary across hours/budget/reporting. |
| Extra-hours funding hierarchy and redistribution approvals | MISSING | Add governed requests, available-balance validation, decisions and immutable before/after evidence. |
| R0-V0 and exact R/V issuance lifecycle | MISSING | Add persistent R/V identity, evidence, issuance, correction, approval and reopen rules. |
| QC conflict/eligibility and independent approval | PARTIAL | Existing workflow roles are generic codes; add actual-user eligibility and conflict checks. |
| Grouped-floor split with lineage | MISSING | Add child UUIDs, preserved allocation/history and Change Order escalation when contractual. |
| Controlled visible-code correction with historical alias | MISSING | Add request/approval and alias resolution without changing UUID/R/V/history. |
| Exact 10.00% Change Order authority | PARTIAL | Reuse the existing module and add immutable pre-change baseline plus exact threshold enforcement. |
| `Result` worksheet Intake importer | MISSING | Add no-VBA parser, structural-row detection, preview, validation, evidence retention and controlled activation. |
| EDT/economic/QC/RV/audit reporting | PARTIAL | Extend existing reporting from canonical new records; do not build disconnected dashboards. |

## Duplicate-prevention decisions

1. Reuse `companies` and the current company catalog routes.
2. Reuse `company_delivery_workflow_*` records and runtime tables.
3. Reuse Workflow Governance Policy identities and versions.
4. Reuse Commercial company pricing templates and bindings.
5. Reuse `job_intakes` and `job_activation_*` operational records.
6. Reuse Schedule buckets/Sprints.
7. Reuse the Change Order module and canonical project documents.
8. Extend the existing audit/event spine; no independent EDT audit log with conflicting authority.

## Protected non-regression set

- Authentication, company/project scoping and Super Administrator data-driven authority.
- Intake/APU workflows already accepted in production.
- Operations tasks, packages, document connections and budget baselines.
- Files, RFIs, Submittals, Transmittals, Change Orders, Schedule and Reports.
- Coordination Knowledge and Lens Next web integration.
- Native/installer code and customer records.

## Acceptance

- Every approved v1.2 capability is classified as reusable, partial or missing.
- Every reusable source has an explicit extend-not-duplicate disposition.
- The program scope remains 60 builds; no padding build or duplicate product authority was found.
