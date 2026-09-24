# Build 05 — repair and acceptance matrix

This is the first-block audit disposition. It does not claim a product fix, production migration, customer template, or end-to-end acceptance.

| ID / severity | Reproduction or exact evidence | Expected | Actual / disposition |
| --- | --- | --- | --- |
| TI-01 / S1 | On the published RRY company Governance page, read the note above the rule tables; source `CompanyWorkflowGovernance.tsx` and `workflow-governance-binding.ts`. | Published approval, change and permission rules either enforce decisions or clearly remain unavailable. | UI stores a matrix explicitly described as intent; only selected validation and preexisting PMO/Finance/task-role checks run. Complete enforcement and independently test before acceptance. |
| TI-02 / S1 | Open published project 53 Intake, choose Back to quick setup; observe Project classifications with Discipline, Service and Phase. Source `QuickJobIntake.tsx` includes `MasterClassificationSelectors.tsx`. | Service/Phase selected or derived at correct Work Item/workflow level, with no contradictory global project prompt. | Service and Phase remain visible in Quick Start. Remove global fields with a non-destructive draft migration and verify task/package semantics. |
| TI-03 / S1 | Read `living-brief/STATUS.md` EDT Block 14 and `routes/edt-engine.ts`. | New-project governed activation/EDT/economic/time path is available and role-tested. | New guarded EDT mutations remain closed; read-only preview and prior legacy activation do not satisfy the stated acceptance gate. Finish canonical role authority and safe server-derived path. |
| TI-04 / S2 | Compare the supplied 15-page PDF with the deployed Headquarters routes. | Guide begins with create/approve/publish template and policy, then follows one project to Operations. | Guide assumes templates exist, skips their lifecycle, and cannot be used as completion evidence. Replace only after live UI passes. |
| TI-05 / S2 | Supplied L04 screenshot says select client "en L02" while checking floors. | Client at project/contract; floor at EDT/Work Item. | Ambiguous/incorrect instruction. Correct both UX and test wording. |
| TI-06 / S2 | `delivery-workflow-defaults.ts` versus the empty published RRY company library; `job-intake-service.ts` creates generic `scope-delivery` tasks while `delivery-workflow-runtime.ts` creates template steps. | Two clearly labeled company Shop/Sleeve definitions drive distinguishable Work Items, tasks, economics, roles and reports. | Built-in variants exist but are not BIMTECH templates; exact company variation and complete downstream mapping are not field-proven. Use disposable synthetic QA fixtures only. |
| TI-07 / S2 | Live authoring/Intake inspection used Roberto's RRY session only. | PMO author, separate Finance checker, Intake user, PM, executor and QC each complete the authorized path and reject incorrect actions. | Six-role live acceptance is absent. Do not infer Lorena's or Rubén's BIMTECH access from the RRY page. |

## Closure sequence

1. Correct Intake field authority and protect saved historical drafts.
2. Complete template/policy lifecycle and real policy enforcement without duplicating Commercial APU or project Budget Governance.
3. Prove two synthetic company workflows through Contract/APU, approved synthetic budget, Intake, EDT, immutable Work Item snapshots, roles, documents, hours and reports.
4. Publish after each verified two-block pair. Test actual authenticated roles and negative paths. Replace the guide only after the deployed complete journey passes.

Block 01 contains five bounded audit commits. Its local tests and push establish a reviewed source inventory only; no customer retest request is authorized from this evidence.
