# Coordination Delivery Release C — Build 12

Date: 2026-09-09

## Result

`RESULT=PENDING_FULL_BUILD`

Build 12 adds a backend-only, project-administrator, read-only SharePoint credential lifecycle projection. It combines current credential state with sanitized enrollment, rotation, activation and validation-rejection history while excluding tokens, protected envelopes, keys and provider response material. No real credential, provider request, schema change or frontend work is included. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program.

## Task lock

- `OBJECTIVE=sanitized project-scoped SharePoint credential lifecycle projection`
- `ALLOWED_LAYER=Platform read contract, PostgreSQL read-only projection, authenticated route and focused tests only`
- `FROZEN_COMPONENTS=all credential mutations, frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, schema, real credentials, provider network, live database, publication and deployment`
- `STOP_CONDITION=project-admin authority, project/company isolation, explicit allowlisted reads, strict sanitized output and rollback proofs pass`

## Contract

- `GET /api/v1/projects/:projectId/coordination-hub/credential-lifecycle` is authenticated and restricted to current project administrators.
- The projection runs in one repeatable-read, read-only transaction and verifies the authenticated actor, company and project before reading lifecycle state.
- A credential is visible only when an immutable SharePoint mapping or a project-tagged activation, rejection or rotation audit already ties it to the requested project.
- Unvalidated and unmapped company credentials are deliberately absent because the current persistence authority cannot prove their project relationship.
- Current records expose only credential ID, SharePoint provider, bounded label, lifecycle state, positive key version, creating user, enrollment time and project-mapping status.
- Lifecycle events expose only enrollment, rotation-pending-validation, activation and validation rejection with attributable user, timestamp, optional prior/new key versions and sanitized evidence code.
- All query projections are explicit. Token material, ciphertext, IVs, tags, wrapped keys, configuration digests, provider bodies and generic row selection are excluded.

## Verification

- Credential lifecycle service strict-output behavior: PASS.
- PostgreSQL read-only transaction behavior: PASS.
- Project-admin denial and rollback: PASS.
- Project/company relationship filtering: PASS.
- Protected-field exclusion: PASS.
- Coordination Hub runtime trust boundary: PASS.
- API TypeScript check: PASS.
- Full production build: PENDING.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=PENDING_FULL_BUILD`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_CREATED_OR_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

Build 12 closes the currently defined local Release C backend sequence. The next step is an integration and production-readiness checkpoint against MAIN04's authoritative completion state, not another autonomous feature build.
