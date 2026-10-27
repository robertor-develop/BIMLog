# Lens governed fields and multi-viewpoint Issue — Build 010 evidence

## Scope

- Governed Issue field catalogs are project-scoped, versioned, refreshable, and fail visibly when stale.
- Authorized users can edit Trade, Floor/Level, Responsible Company, Report Type, Priority, Status, Instruction, and Open Items with optimistic concurrency and audit reasons.
- One immutable BIMLog Issue can own multiple independently named, ordered, primary, archived, and historically versioned Navisworks viewpoints.
- Viewpoint history is separate from Issue workflow activity. The selected viewpoint drives the explicit Open action.
- English, Spanish, and Portuguese labels are available for the new governed catalog and multi-viewpoint workflow.

## Mainline / Pools root cause

Read-only production diagnostics found no active `companies`, `project_directory`, `project_members`, naming-convention company code, or historical Lens label matching Mainline or Pools in the active BIMLog database used by Lens. The missing option was therefore not a stale dropdown cache or pagination defect: it was never present in the active project authority that Lens reads. No production data was changed during diagnosis.

## Security and data boundaries

- Every read is authenticated and project-member scoped.
- Every mutation requires project `admin` or `write` permission.
- Company choices come only from the active project authority; historical-only values remain visible but cannot be newly assigned.
- Added viewpoints require an exact Issue identity, model fingerprint, visual-state digest, mutation version, idempotency key, and audit reason.
- Additive migration backfills exactly one deterministic primary viewpoint for each existing Issue without rewriting `lens_viewpoints`.
- A partial unique index enforces one active primary viewpoint per Issue.

## Compatibility

- Existing Issue identity, workflow activity, links, attachments, Resolution, and primary working-view behavior remain intact.
- Excel includes every Issue viewpoint with Primary/Archived disclosure.
- XML V2 explicitly discloses that it exports only the primary viewpoint; additional viewpoints remain listed in Excel.
- Frozen fallback `v1.05.N10-P05` was not modified.

## Automated evidence

- Replit API TypeScript typecheck: PASS through Build 009.
- Replit BIMLog TypeScript typecheck: PASS through Build 009.
- Build 006 additive migration/backfill behavior: PASS.
- Build 007 Add Viewpoint API/client/native-capture contract: PASS after explicit client parameter typing correction.
- Build 008 gallery/lifecycle behavior: path correction included in Build 010 candidate.
- Build 009 export/history compatibility behavior: pending final exact-commit rerun.
- Full build functional suites reached the Living Brief reconciliation gate; final exact-commit full build remains required after this evidence is reconciled.

## Manual acceptance still required before customer rollout

- Exact deployed Chrome journey with an authorized project and real production-like project directory data.
- Real Navisworks Manage 2021 model: add two viewpoints to one Issue, switch/open each, rename, reorder, change primary, archive non-primary, and verify camera/selection isolation and separate histories.
- Production migration dry run/backup evidence before schema application, then post-deploy row-count and one-primary invariant verification.
