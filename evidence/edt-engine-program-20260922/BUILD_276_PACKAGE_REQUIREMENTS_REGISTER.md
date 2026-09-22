# Build 276 — package integrity and requirements register

Date: 2026-09-22

Baseline: `c97efd491f15d393f7c432419f2e2d908cd574a8`

Scope: read-only package ingestion and authoritative requirement classification

Result: `PASS`

## Integrity

The complete package at
`F:\BIMLog\Evidence\edt-engine-package-audit-20260922\BIMLOG_EDT_ENGINE_IMPLEMENTATION_PACKAGE`
was checked against `12_SHA256SUMS.txt`. All 12 listed files matched their expected SHA-256.
The source package remains outside the repository and was not modified or duplicated.

## Source classification

| Source | Classification | Permitted use |
|---|---|---|
| `01_MAIN04_FULL_IMPLEMENTATION_INSTRUCTION.md` | Execution scope and prohibitions | Defines requested outcomes and release boundary; it is not evidence that an outcome already exists. |
| `02_BIMLOG_MAIN00_200_MICROBUILD_FINAL_HANDOFF.md` | Historical evidence baseline | Reconcile against current source; never treat its historical head as the current release. |
| `03_BIMLOG_Engine_Templates_v1.2_Architecture_Closure_FINAL.docx` | Approved functional architecture | Canonical engine, identity, snapshot, activation, budget, R/V and Change Order decisions. |
| `04_BIMLog_Role_Governance_Responsibility_Matrix_v1.2_FINAL.docx` | Approved role/governance authority | Canonical roles, permissions, eligibility and separation-of-duties rules. |
| `05_REQUERIMIENTO_CREACION_AUTOMATICA_EDT.docx` | Original customer requirement | EDT, floor/area budget and task-execution intent, interpreted through the v1.2 authorities. |
| `06_10_VAN_CORTLANDT_HVAC_ESTIMATE.xlsm` | Import/evidence specimen | Read `Result` without executing VBA; never promote workbook formulas or macros to business authority. |
| `07_*` and `08_*` | Illustrative UX references | Layout and interaction guidance only; no independent business rules. |
| `09_*`, `10_*`, `11_*` | Current-state defect evidence | Demonstrate incomplete shells/navigation; not acceptance evidence. |
| `00_PACKAGE_MANIFEST.md`, `12_SHA256SUMS.txt` | Package inventory and integrity | File classification and byte-integrity proof. |

The stale closing reference to Role Governance v1.1 in Architecture Closure v1.2 is superseded by
the opening authority statement and the attached Role Governance v1.2 document, as explicitly
recorded in the package manifest.

## Approved requirement register

1. Keep one canonical chain: Project → Contract → Work Item → Delivery Workflow Instance →
   stage/task → assignment/hours/QC/approval.
2. Preserve Project Governance, Contract APU/Pricing and Delivery Workflow as distinct, versioned
   authorities whose approved versions are snapshotted at activation.
3. Define a Work Item by Location + Trade + Deliverable Type, with permanent UUID and deterministic
   visible code. Stage, task, revision and issuance are not Work Items.
4. Complete governed list/detail/editor lifecycles for Company Catalogs, Delivery Workflows,
   Governance Policies and APU/Pricing Templates.
5. Keep APU/Pricing canonical in Commercial. Delivery owns operational phases/tasks; APU owns
   economic pools/default allocation; activation freezes a Work Item Economic Plan.
6. Generate EDT and runtime tasks automatically from validated Intake configuration and frozen
   snapshots without creating duplicate authorities.
7. Preserve floor/area as the controlled budget unit, while allowing governed grouping and split.
8. Track Budgeted, Committed/Pending, Approved/Consumed and Available; pending hours immediately
   reduce Available and correction/rejection restores balances deterministically.
9. Protect Direct Production and Project Administrative Labor pools from silently funding each
   other; administrative hours do not create physical progress.
10. Implement R0-V0 initialization, external-revision R increments, internal-issuance V increments,
    exact R/V approval binding and evidence-backed reopening.
11. Enforce backend permission, record eligibility, conflict checks and anti-self-approval.
12. Reuse BIMLog's existing Schedule bucket/Sprint authority instead of creating a second Sprint
    engine.
13. Require formal Change Orders for contractual value/scope/schedule impact, with Operations
    Director approval at or below exactly 10.00% and Operations Director plus CEO above 10.00%.
14. Import the workbook's `Result` worksheet through the last structurally valid row, without VBA,
    with preview, validation, immutable source evidence and controlled activation.
15. Preserve actor, eligible role, record identity, before/after state, reason, evidence, timestamp,
    decision and version/snapshot identity for every governed action.

## Explicit exclusions

- No production deployment or production database migration is authorized by the package.
- No redesign or extension of Lens Next or Pulse is included.
- No duplicate Company, Client, Discipline, APU, Sprint, issue or document authority may be created.
- No mock acceptance evidence, silent fallback, autonomous approval or destructive history rewrite.

## Acceptance evidence

- Package hash comparison: `MATCHED=12 TOTAL=12`.
- Workbook inspection: 12 worksheets; `Result` has structural range `A1:D289`; VBA was not run.
- Package sources were classified before any product mutation.
