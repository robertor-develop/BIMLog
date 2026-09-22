# Build 279 — additive EDT schema and migration plan

Date: 2026-09-22

Result: `PASS_DESIGN_ONLY`

Database connected: `NO`

Migration executed: `NO`

## Existing authorities to extend

The current source already defines `job_intakes`, `job_activation_work_items`, tasks, resource
assignments, time entries, task deliverables, work packages, budget accounts/baselines, execution
baselines, operation events, Delivery Workflow templates/runtime snapshots, Governance Policy
versions and Commercial pricing bindings. The EDT implementation must extend these authorities.

Every accepted schema change must land in both:

1. `lib/db/src/schema/*` Drizzle definitions; and
2. the matching idempotent runtime migration invoked from `artifacts/api-server/src/app.ts`.

## Proposed additive structures

### EDT hierarchy

`job_activation_edt_nodes`

- permanent UUID primary key;
- `company_id`, `project_id`, `intake_id`, optional `parent_id`;
- node kind constrained to Project, Contract, Deliverable or Location;
- stable source identity, code, name, sequence and active state;
- source snapshot/fingerprint and created actor/time;
- unique stable source within an Intake and deterministic sibling ordering.

Existing `job_activation_work_items` gains nullable additive identity columns first:

- `edt_node_id`;
- location identity/snapshot;
- trade identity/snapshot;
- deliverable-type identity/snapshot;
- deterministic `display_code`;
- `revision_number` and `issuance_version` defaulting to zero for new EDT records;
- optional `split_from_work_item_id` and grouped-location evidence;
- immutable identity/economic-plan fingerprints.

Existing rows remain readable before any controlled backfill. No existing primary key or
`stable_scope_item_id` is removed.

### Visible-code history

`job_activation_work_item_code_aliases`

- alias code, Work Item UUID, project/company scope;
- valid-from/valid-to timestamps;
- change-request/decision identity and reason;
- unique active visible code within the project;
- lookup index supporting historical deep links.

### Activation and governed actions

`job_activation_requests` and `job_activation_decisions`

- exact Intake revision and request fingerprint;
- requested Governance/APU/Workflow versions;
- requester, eligible role, reviewer/approver, outcome, reason and evidence;
- idempotency key and optimistic version;
- no approval without a matching request and exact fingerprint.

`job_governed_change_requests` and `job_governed_change_decisions`

- typed actions for redistribution, extra hours, code correction, split and reopen;
- exact target identity/version;
- before/after payload fingerprints;
- actor, eligible role, conflict result, reason, evidence and decision time.

Existing Change Order tables remain canonical for contractual changes and are referenced rather
than duplicated.

### Work Item economic plan and budget ledger

`job_activation_work_item_economic_plans`

- Work Item, Contract, contract-version and pricing-template-version identities;
- Delivery Workflow snapshot and resolved allocation;
- Direct Production, Project Administrative Labor, incentive and earnings pools;
- currency, total, source fingerprint and immutable plan fingerprint.

`job_activation_budget_ledger_entries`

- account, Work Item/task/assignment/time-entry references;
- pool and state transition;
- amount/hours delta;
- immutable idempotency key, source version, actor/reason/evidence and timestamp.

Balances remain deterministic projections of ledger entries. No mutable balance column becomes a
second financial authority.

### Hours and R/V

Existing `job_activation_time_entries` gains status, optimistic version, submitted/decided actor
and timestamps, correction/supersession linkage and source fingerprint. Existing rows receive a
documented compatibility state only through a separately tested backfill.

`job_activation_work_item_issuances`

- Work Item UUID, R, V, package/evidence identity and fingerprint;
- issuance kind and state;
- submitted actor/time, QC decision and exact approval binding;
- uniqueness on Work Item + R + V.

`job_activation_qc_decisions`

- exact issuance, reviewer, eligible role, conflict evaluation, decision, reason and evidence;
- database uniqueness preventing duplicate current decisions for the same review step.

### Workbook import

`job_intake_import_batches` and `job_intake_import_rows`

- original file/evidence reference, byte hash, worksheet name and parser version;
- structural range, preview fingerprint, status, requester/reviewer/activator;
- row number, normalized source fields, validation state/errors and mapped canonical identities;
- unique file hash + parser version + Intake revision for repeat-safe preview/apply behavior.

The original workbook remains governed file evidence; rows are not silently reparsed after
activation.

## Constraints and indexes

- Scope foreign keys bind company → project → Intake → EDT/Work Item.
- Deterministic code uniqueness is active-scoped per project.
- R and V are non-negative; issuance identity is unique per Work Item.
- Fingerprints are lowercase 64-character SHA-256.
- Percent allocations use exact decimal constraints and sum validation in the service transaction.
- Optimistic revisions are positive.
- Partial indexes cover active aliases, open action requests and current approvals.
- Append-only event/ledger/decision rows have no ordinary update/delete route.

## Migration sequence

1. Create new tables, indexes and constraints without referencing unpopulated new columns.
2. Add nullable columns to existing tables.
3. Deploy dual-read compatibility code and create new records only through the new contract.
4. Run a deterministic preview of legacy-row classification and unresolved exceptions.
5. Apply an explicitly authorized transactional backfill with row counts/fingerprints.
6. Validate foreign keys, uniqueness and parity in a disposable database.
7. Only after production evidence is complete may later code make new fields mandatory for newly
   activated records. Historical records remain preserved.

## Zero-drop rule

Allowed in the initial migration:

- `CREATE TABLE IF NOT EXISTS`;
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`;
- additive indexes, foreign keys and checks after compatibility proof;
- idempotent seed of BIMLog product defaults only where no company authority exists.

Forbidden in this program without a new exact authorization:

- `DROP`, `TRUNCATE`, destructive `DELETE`, table/column rename or type narrowing;
- rewriting historical UUIDs, fingerprints, R/V, approvals, financial events or customer data;
- production backfill or migration execution;
- replacing existing company, workflow, pricing, Sprint, Change Order or document authorities.

## Rollback and recovery

- Before production migration: verified backup and row-count/fingerprint snapshot.
- Migration transaction rolls back on any failed statement or parity check.
- New code must tolerate absent new rows during the dual-read stage.
- Failed activation/import/action requests are idempotently retryable and cannot leave partial
  ledger, EDT or approval records.
- Recovery disables new writes and preserves additive structures; it never deletes accepted data.

## Acceptance

- Design is additive and preserves all existing identities.
- Every new authority has one purpose and references existing canonical records.
- Drizzle/runtime-migration parity is mandatory for implementation.
- Production mutation remains explicitly unperformed and unauthorized at this build.
