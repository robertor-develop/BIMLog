# Build 04 — Shop Drawing versus Sleeve path trace

This build compares the actual existing paths without creating a BIMTECH production template or asserting that the customer's variants exist.

## What is already distinct in source

- `artifacts/api-server/src/lib/delivery-workflow-defaults.ts` defines separate built-in `SHOP_DRAWING` and `SLEEVE` choices. Shop Drawing uses Preliminary/For Record with DRAFTER execution, QC review, Project Manager approval and a required DRAWING at issue. Sleeve uses Sleeve layout/Release with MODELER execution, QC review, Project Manager approval and a required DRAWING at issue. Their phase/task IDs and descriptions differ.
- These are BIMLog defaults, **not** BIMTECH-approved company templates. They have no independently authored company economic allocation. They do not satisfy the user's requirement to prove two different *company-authored* versions with different economics.
- `components/job-intake/ContractItemBulkEditor.tsx` exposes each Contract Item's deliverable type and Delivery Workflow version selector in Advanced; the company-version options are filtered by deliverable type. A sole compatible company version is auto-selected; multiple require explicit choice by `delivery-workflow-selection.ts`.
- `job-intake-service.ts` passes each item's deliverable type and selected version into `bindDeliveryWorkflowWithClient` during activation. That service stores exact source/version/definition/fingerprint, phase checks, steps and role assignments in the same transaction. Work Item runtime then checks assigned users, documents, QC and approval against that frozen definition.

## Important unresolved split

- The existing `job_activation_tasks` path creates a generic `scope-delivery` task for an unsplit Contract Item, while the company workflow engine separately creates `company_delivery_workflow_steps` from the selected template. The Operations UI must make this relationship explicit and the EDT projection must not pretend the generic task is the complete template task tree.
- The newer governed EDT read path is available, but the mutating EDT approval/activation/economic/time routes remain guarded per `living-brief/STATUS.md` Block 14. No positive new-project EDT approval has been field-proven.
- Intake classification currently carries one draft-level `classification` value into activated task columns. Service/Phase in Quick Start therefore continue to behave as project-level defaults; that is the inconsistency Lorena reported.

## Required later proof

Create clearly labeled synthetic company Shop Drawing and Sleeve definitions with different phase/task/role/gate/document/economic allocations. Use two Contract Items in one QA job, bind distinct eligible canonical APU versions, then verify exact published version IDs, immutable Work Item snapshots, EDT/task mapping, hours and reports after refresh. Do not substitute the built-in defaults for BIMTECH's approved templates.
