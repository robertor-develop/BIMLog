# September 28 meeting requirements — revised 150-build scope

Source: Roberto's meeting notes and detailed follow-up after the site audit; subsequent clarification confirms **$3.50/hour applies only to excess hours**. Status: requirements recorded and proposal revised; no implementation, production data changes, rate changes, provider configuration or deployment performed.

These decisions supersede conflicting recommendations in the original 100-build proposal. Original files remain in `history-100-build-proposal`. Current program: UX001–UX150, 30 blocks. Additional items are integrated dependencies, not a queue to postpone until after UX100.

## Subsequent direction: the whole journey must make sense

Roberto reports that he and Ruben could not reliably understand what flowed into what, what came next, where navigation went, how to return, or how to complete the work. They tried the guide, help and manual and those did not resolve the confusion. This is direct user-session evidence, not a claim that this audit reproduced every failure they encountered.

Record as **R19 — end-to-end comprehensibility** and **R20 — usable, accurate guidance**. These apply across all prior requirements, not only to Intake. Evaluate business workflow, information architecture, visual hierarchy, terminology, commercial confidence and discoverability together. Do not close these concerns with a reskin, more explanatory banners, or a longer manual.

Every core journey must let the user identify current context/state, next action, prerequisites, resulting changes, saved state and return path. Help must describe the actual released screen and role. A complete real user journey is required evidence; separate module checks are insufficient.

The current decomposition remains 150 microbuilds, but **150 is not a scope ceiling**. If concrete uncovered work requires 180 or another count, add bounded outcomes and dependency/acceptance evidence rather than padding the count. All discussion decisions must remain traceable to implementation and acceptance; no later summary may silently restore Quick Setup, compulsory named staffing or the old conflicting rate paths.

Traceability: UX003–005 (journey architecture/prototype), UX016–020 (continuity), UX077–080 (language/interaction), UX085 (guide/help/manual), UX096–099 (complete user journeys), UX150 (Roberto/Ruben scenario). The release acceptance in MICROBUILDS.md is tightened accordingly.

## Requirement-by-requirement understanding

| ID | Roberto's requirement | Required product behavior | Build traceability |
|---|---|---|---|
| R01 | Eliminate Quick Setup | One full resumable setup. No initial quick pass followed by a second full pass; existing drafts preserved. Optional field disclosure remains within full setup. | UX021, UX031–035 |
| R02 | Add disciplines on the spot; allow multiple | Multi-select project disciplines, inline authorized creation, immediate selection and shared use throughout the project. Investigate why only two appeared rather than adding another competing catalog. | UX014, UX101–105 |
| R03 | Building levels belong in Intake | Explicit project building/level list, reusable across scope, floors, EDT, schedule and delivery; ordered floor labels and stable identities. | UX023–024, UX103–105 |
| R04 | Compact, smart discipline choices | Selected project set plus company/user pinned and frequent choices. Search/Add more remains available; no 50-option default wall and no silent deletion of rare values. | UX106–107, UX110 |
| R05 | Smart document-type choices | Show common/recent/pinned types relevant to the project, with full eligible catalog on demand. Existing document types/history remain intact. | UX108, UX110 |
| R06 | Status codes belong to delivery workflow | Available states and transitions derive from the chosen published workflow/version and role. Frequency ranking must not invent or bypass lifecycle states. | UX109, UX141–145 |
| R07 | BIM coordinators, especially BIMtech, deliver shop drawings | Shop-drawing-first company preset and main deliverable journey; include coordination, review, issue/revision and closeout. Other legitimate deliverables remain available. | UX024, UX141–145 |
| R08 | General APU library across projects | Discoverable Library button in Intake/APU, named searchable prior/published APUs, preview/version/units/currency, reuse with provenance. Company-wide authorized reuse, not cross-tenant disclosure. | UX075, UX111–115 |
| R09 | Correct project APU unit rate; investigate $30→$35.47 | Bind exact project APU/version/rate component and unit/currency. Customer rate cannot silently change when choosing a resource role, another APU or governance. Display selected source and intentional override. | UX026–027, UX116–120 |
| R10 | No named-person delegation in Intake | Replace assignment form with generic resource planning. Budget role/hours/cost without choosing an employee. Unassigned work can activate and remain pending for future floors. | UX025, UX033–035, UX121–125 |
| R11 | Internal cost comes automatically from member profile | Later in Operations, selecting a member resolves that member's effective approved internal rate. Keep customer price, generic planned cost and actual member cost distinct. | UX037–039, UX126–130 |
| R12 | Project governance includes CEO-approved internal cost | Versioned cost policies/profiles with effective date, CEO approval, access controls and audit. No arbitrary Intake rate edits or silent retrospective rewrites. | UX126–135 |
| R13 | Three internal cost rates | Drafter $5.10/h; coordinator $6.50/h; $3.50/h only on hours above the approved floor estimate. No blanket repricing of all floor hours after crossing the threshold. | UX126–135 |
| R14 | Fix missing canonical Contract version in EDT | Preserve integrity guard; guide user to create/link/repair exact canonical contract version and return. Existing work remains unchanged until verified reconciliation. | UX136–140 |
| R15 | Avoid re-entering work items in Contracts & Commitments | Intake-first recommendation: create/link one canonical draft per agreement, reuse items/APU/version/rates. Existing-contract entry remains supported through explicit selection. Never create a parallel duplicate contract. | UX018, UX029, UX034, UX136–140 |
| R16 | Convention Builder returns to Intake | Explicit Complete/Cancel and return to exact stage/item/revision, with saved-state protection and refreshed selected convention. | UX017, UX024, UX042, UX150 |
| R17 | Engagements is incomprehensible | Use Companies and agreements: who hires whom, who delivers, which contract applies. Simple projects should not require diagramming business relationships; advanced structures remain possible. | UX011–012, UX022, UX077, UX136 |
| R18 | SendGrid configuration available in setup and before send | Optional email-readiness step and Configure action in full setup; same readiness at send time. Authorized configuration returns to the unsent draft. No provider-ready claim from merely saving a key. | UX073, UX146–150 |

## Clear separation of the three rate layers

1. **Customer unit price:** exact project APU/rate component bound to a scope/contract item. Unit may be hours or another deliverable quantity. It is not an employee's cost and not automatically the entire APU plan selling total.
2. **Planned internal cost:** approved generic resource role × estimated hours, allocated to scope/level. It works before employees are hired. It establishes a planning baseline, not a fabricated named assignment.
3. **Actual/effective member cost:** resolved from the assigned member's approved profile and applicable policy when actual work is recorded. Future policy/profile updates do not silently reprice historical approved work.

A library template, a project-specific APU and a contract's frozen APU/rate reference are related versions, not interchangeable records. The interface must name each and show the lineage. A customer-rate selector must not contain unrelated fixed profiles named Drafting $35.47 or Coordinator $37.99 when the user selected a $30 project rate.

The stated BIMtech role rates are **user-provided policy inputs**, not facts independently verified against payroll and not globally hard-coded platform defaults. No personal rate for Lady Paredes was read or assumed; her name is the user's example of later person-specific rate lookup.

## Confirmed excess-hours rule

Roberto explicitly answered: **Only excess hours**.

For an illustrative single-role floor with approved estimate `E`, eligible actual hours `H`, and approved normal rate `r`, the expected calculation is:

`normal hours = min(H, E)`

`excess hours = max(H - E, 0)`

`cost = normal hours × r + excess hours × 3.50`

Examples for a 100-hour floor estimate, assuming one role and all hours are eligible:

| Role | Actual hours | Expected cost |
|---|---:|---:|
| Drafter at $5.10 | 90 | $459.00 |
| Drafter at $5.10 | 100 | $510.00 |
| Drafter at $5.10 | 110 | $545.00: $510 normal + $35 excess |
| Coordinator at $6.50 | 110 | $685.00: $650 normal + $35 excess |

This is an internal-cost software rule, not an instruction to execute payroll or change customer billing. The cost panel should show baseline hours, normal/excess hours, applicable profile/policy version and calculation separately.

Before implementing mixed-role/mixed-person allocation, specify the authoritative floor estimate, eligible time states, ordering of entries when a threshold is crossed, rejected/corrected time, approved estimate revisions and currency. Recommended design: a versioned approved baseline and deterministic allocation of accepted hours with explicit correction history. The aggregate-floor versus per-role budget allocation detail must be validated against the existing business policy; do not invent it. CEO approval remains required to activate/change the cost policy.

## Contract and EDT sequence recommendation

**Default:** Full Intake → review → create/link canonical draft contract with its items → verify/freeze the appropriate source version under existing rules → project EDT and operating work. Existing commercial approvals remain separate from draft creation and operational activation.

**Existing contract:** choose an authorized existing contract in Intake, import/reference its scope under deliberate reconciliation, and continue. Do not ask for the same work items again in Commitments. Do not silently overwrite an issued/approved version.

For operational-only projects, preserve the existing commercial entitlement boundary. If an optional commercial EDT projection requires a contract, explain that specific projection requirement; do not make the entire job unusable or fabricate a contract merely to silence the error.

The reported error, “This activated Intake has no verifiable canonical Contract version…”, should lead to a diagnosis of the missing link and a specific repair action. Removing the error guard is not an acceptable fix. Re-running repair must not duplicate tasks, contracts or work items.

## Investigation: what was confirmed

Reviewed source root: `F:\BIMLog\Worktrees\bimlog-template-gap-block01-20260923`, HEAD `c0e3781c82daa2d3db219afcbbbcae5673be734c`. Live release label: v1.05.N18-P36.

### Confirmed source and live UI mechanisms

- `artifacts/bimlog/src/lib/job-intake-apu-rates.ts:1` defines hard-coded customer profiles `drafting = 35.47` and `bim_coordinator = 37.99`.
- The same file's `applyAssignmentApuRate` replaces the selected scope item's `billingHourlyRate`; it does not change the selected APU version. Thus these two displayed references can be changed through separate paths.
- `artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx:2589` invokes that rate change from the resource-plan profile selector; the $35.47/$37.99 options appear at lines 2593–2594. Live P58 shows those options both in advanced item controls and the Team & resource plan.
- `artifacts/bimlog/src/lib/job-intake-apu-default.ts` binds a sole saved version without changing the item's rate. Live text explicitly says to choose a saved APU version and enter its item rate separately. This is not the behavior Roberto expects from a correctly selected unit-price APU.
- `artifacts/bimlog/src/pages/FinancialContractWorkspace.tsx:18` initializes a new contract line's `unitRate` from `apu.sellingPrice`; line 97 loads the project plan. This is a second potential semantic inconsistency if that field is a plan total rather than the desired unit-rate component. It is a source finding, not a reproduced financial transaction.
- `artifacts/api-server/src/lib/job-intake-contract.ts:985` requires at least one assignment and a user or person name; lines 1039–1044 include assigned hours ≥ planned hours in team readiness. This confirms that replacing only the screen would be insufficient: readiness rules must support generic resource planning and unassigned future work.
- `artifacts/bimlog/src/components/job-operations/EdtPlanPreviewPanel.tsx:15` contains the exact reported contract-source error. The projection requires canonical contract/version bindings; preserve those checks while repairing the workflow.
- Live P58 states that activation creates controlled draft contracts from Intake profiles. Therefore the proposed fix must reconnect/reuse this existing capability, not build another contract generator.

### Log check requested by Roberto

The existing Chrome session is **Roberto Test 1 / BIMCorp Inc**, scoped to administered projects. Project Administration → Activity Feed showed **155 events**; the newest visible event was September 27, 2026, 3:12:34 PM, in TEST C020 FUNDS 20260927. The visible feed did not identify September 28's reported $30 APU setup. Admin Log's final loaded state showed zero actions. These general logs do not establish the history of every APU revision.

**Exact incident remains uncorrelated:** Roberto did not recall the project name and asked for logs. We have a concrete $35.47 overwrite mechanism and a staffing-readiness cause, but have not proven which project/version was used with Ruben or that this mechanism was the action taken in that session. Do not label P58 as that incident; it is the audit comparison fixture. Further correlation needs the authorized financial/Intake revision event source or the correct account/project context. No credential change, impersonation, database query or production mutation was performed to obtain broader access.

## Acceptance scenario added to the program

Prepare a seven-floor, 19-month BIMtech job with multiple disciplines and Shop Drawing as its default deliverable. Use the General APU Library to select a known $30 unit rate. Allocate generic drafter/coordinator budgets without employee assignments. Detour to Convention Builder and email configuration, then return to the exact setup state. Activate once; ensure one intended contract/item/version lineage and a verifiable EDT. Later assign one task to an authorized named member: her internal rate resolves from the approved profile and the $30 customer rate remains unchanged. Record hours crossing the approved floor threshold: only excess hours use $3.50. Verify saved/reloaded UI, contractual values, planned/actual cost, reports and historical versions agree.

External sends, credentials, financial approvals and production mutations remain their own governed actions. This scenario is a specification, not a claim it has been run.
