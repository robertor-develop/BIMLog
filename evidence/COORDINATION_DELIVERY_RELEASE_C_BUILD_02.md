# Coordination Delivery Release C — Build 02

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 02 adds the backend-only, authenticated Coordination Hub summary contract. It deliberately does not implement customer UI because MAIN04 owns the separate BIMLog UX-compliance program and its frontend worktrees.

## Task lock

- `OBJECTIVE=authenticated read-only Coordination Hub project summary`
- `ALLOWED_LAYER=Platform API and transactional PostgreSQL store only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, schema, provider workers, provider systems, live database, publication and deployment`
- `STOP_CONDITION=bounded summary contract passes project/company isolation, read-only consistency, payload exclusion, focused tests and full local gates`

## Implemented contract

- `GET /api/v1/projects/:projectId/coordination-hub/summary`
- Existing authentication and project-membership middleware are mandatory.
- Company and actor identity come from the authenticated server session.
- The store repeats the company/user/project authority check inside the database transaction.
- Reads run under `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`.
- Counts cover files, revisions, current files, active jobs, attention jobs and active company credentials.
- Latest files and recent jobs are independently project/company scoped, deterministically ordered and limited to 20 rows each.
- Job payloads, idempotency keys, request digests and all credential-envelope fields are excluded.
- Unknown failures retain the existing sanitized correlation-ID response.

## Disposable PostgreSQL proof

- A fresh loopback-only PostgreSQL 18 cluster was created on port 55439.
- The current integrated schema applied and produced 205 public tables.
- Two companies, two users, two projects, two credentials, two Coordination Files, two revisions and two jobs were created only as disposable fixtures.
- The ALPHA summary returned exactly one ALPHA file, revision, current designation, active job and credential; no BETA record appeared.
- Cross-project and cross-company summary attempts failed closed.
- Two successive reads returned identical business data and independent valid observation timestamps.
- Job payload marker data did not appear in the serialized summary.
- Summary reads left connector-job row counts unchanged.
- The disposable cluster was stopped and its verified worktree-local directory removed.
- The existing PostgreSQL listener on port 55432 remained available after cleanup.

Two harness assertions were corrected during rehearsal: the first accidentally supplied a credential ID inside strict scope input, and the second incorrectly expected separate observation timestamps to be byte-identical. Both failures occurred only in the disposable harness; product source and live systems were unaffected.

## Verification

- Coordination Hub service behavior: PASS.
- Coordination Hub runtime behavior: PASS.
- API TypeScript check: PASS.
- Disposable database project isolation: PASS.
- Disposable database company isolation: PASS.
- Repeatable read-only result: PASS.
- Payload and credential-field exclusion: PASS.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next MAIN00-owned Release C work should remain backend-only while MAIN04 owns the UX program. Provider-specific configuration, credentials, workers and network calls remain separate later builds.
