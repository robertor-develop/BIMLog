# Coordination Delivery Release C — Build 11

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 11 adds an explicit, project-administrator-only SharePoint credential-rotation command. It replaces an exact active credential version using compare-and-set semantics, seals the replacement token under the server-held connector KEK, returns the credential to `pending_validation` and writes one sanitized administrator audit record in the same transaction. No real credential, provider request, schema change or frontend work is included. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program.

## Task lock

- `OBJECTIVE=compare-and-set SharePoint credential rotation with mandatory revalidation and atomic audit`
- `ALLOWED_LAYER=Platform request decoding, protected encryption composition, configuration transaction, route wiring and focused tests only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, schema, provider validation implementation, real credentials, provider network, live database, publication and deployment`
- `STOP_CONDITION=active-version CAS, server-owned encryption, pending-validation transition, atomic audit, stale-replay rejection and token-clearing proofs pass`

## Contract

- `POST /api/v1/projects/:projectId/coordination-hub/credentials/:credentialId/rotate` remains authenticated and restricted to project administrators.
- Project, company, actor and credential identity come from the authenticated route context and URL; client-authored scope is replaced.
- The request accepts one canonical unpadded base64url token, the literal expected state `active` and a positive expected key version.
- The active replacement key version comes only from `BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION`; the client cannot choose it.
- The decoded token is mutable and cleared after success or failure. The persistence authority receives only the sealed envelope.
- The atomic update succeeds only when credential ID, company, provider, state and prior key version all match. A stale or repeated rotation fails closed with conflict and no audit.
- A successful rotation replaces only the protected envelope, changes state from `active` to `pending_validation`, and records `coordination_credential_rotated_pending_validation` with project, provider, prior/new key versions and state. No token or envelope material enters the audit.
- Existing mappings remain intact but cannot use the credential again until the established provider-validation path reactivates it.

## Verification

- Connector credential rotation behavior: PASS.
- Configuration service state transition and stale replay: PASS.
- Token clearing on success/failure: PASS.
- Coordination Hub runtime trust boundary: PASS.
- API TypeScript check: PASS.
- Full production build: PASS.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_CREATED_OR_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next backend build may add a sanitized, same-company credential lifecycle projection covering enrollment, rotation, validation and active state without exposing protected-envelope or token material. It must remain read-only and must not duplicate MAIN04-owned UX.
