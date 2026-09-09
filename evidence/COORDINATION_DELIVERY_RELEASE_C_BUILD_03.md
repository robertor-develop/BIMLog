# Coordination Delivery Release C — Build 03

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 03 adds backend-only protected provider-credential registration and immutable SharePoint project/folder mapping contracts. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program; no frontend or Native source was touched.

## Task lock

- `OBJECTIVE=protected provider configuration and project mapping contracts`
- `ALLOWED_LAYER=Platform API, service and transactional PostgreSQL store only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, database schema, provider workers, provider network calls, live database, publication and deployment`
- `STOP_CONDITION=protected-envelope, administrator-authority, immutable mapping, idempotency and rollback proofs pass`

## Implemented contract

- `POST /api/v1/projects/:projectId/coordination-hub/credentials`
- `POST /api/v1/projects/:projectId/coordination-hub/sharepoint-mapping`
- Both routes require existing authentication and the `project_admin` project role; verified super administrators retain the existing middleware bypass.
- The transactional store independently rechecks current same-company project-administrator authority.
- Credential input accepts only the established complete protected-envelope structure. A plaintext `secret` field or any undeclared field fails strict validation.
- New credentials are always stored as `pending_validation`; this build cannot mark them active.
- Responses return credential ID and state only, never protected-envelope fields.
- Mapping creation requires a separately active same-company `sharepoint` credential.
- One immutable mapping authority is allowed per project. Exact replay is idempotent; conflicting site, library, credential or folder configuration fails closed.
- Folder category/trade identities must be unique, folder paths cannot contain a parent-traversal segment and referenced trades must already be active.
- Project mapping plus all folder mappings commit atomically; any folder failure rolls back the project mapping.
- No fetch client, provider URL, worker activation, credential decryption or external side effect exists in this build.

## Disposable PostgreSQL proof

- A fresh loopback-only PostgreSQL 18 cluster was created on port 55439 and received the current 205-table schema.
- A protected SharePoint envelope was registered as `pending_validation` and replayed idempotently.
- The service response contained no envelope field.
- Test setup separately changed only the disposable fixture credential to active, representing the later validation prerequisite.
- One project mapping and two folder mappings were created atomically and replayed idempotently.
- A conflicting library mapping failed closed without changing the accepted mapping.
- A second-project mapping with a nonexistent trade rolled back its provisional project mapping and folder.
- A cross-company active credential was rejected before mapping insertion.
- Final database state contained exactly one accepted project mapping, two accepted folders and zero rejected mapping residue.
- The disposable cluster was stopped and its verified worktree-local directory removed.
- The pre-existing local PostgreSQL listener on port 55432 remained available.

## Verification

- Provider configuration service behavior: PASS.
- Coordination Hub runtime boundary behavior: PASS.
- API TypeScript check: PASS.
- Protected response proof: PASS.
- Exact replay proof: PASS.
- Invalid-trade transaction rollback: PASS.
- Cross-company credential rejection: PASS.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next backend build may implement a controlled credential-validation state transition through an injected provider-validation port. It must not embed provider credentials, activate a worker, contact a real provider or change any MAIN04-owned frontend.
