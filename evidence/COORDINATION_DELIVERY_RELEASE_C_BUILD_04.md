# Coordination Delivery Release C — Build 04

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 04 adds the backend-only, two-phase connector-credential validation and activation boundary. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program; no frontend, Native or Lens Next source was touched.

## Task lock

- `OBJECTIVE=controlled validation and activation of a previously registered protected connector credential`
- `ALLOWED_LAYER=Platform API, service and transactional PostgreSQL store only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, database schema, provider workers, real provider connections, credential decryption, live database, publication and deployment`
- `STOP_CONDITION=authority, two-phase isolation, exact-version activation, rejection, audit, idempotency and race proofs pass`

## Implemented contract

- `POST /api/v1/projects/:projectId/coordination-hub/credentials/:credentialId/validate`
- The route requires existing authentication and the `project_admin` project role; the transactional store independently rechecks current same-company project-administrator authority in both phases.
- Phase 1 reads the exact same-company credential metadata and permits only `pending_validation`; an already active credential returns an idempotent result without calling a validator.
- The injected validation port is called outside every database transaction. It receives only credential ID, company/project scope, provider, label, key version and a SHA-256 configuration digest. It never receives the protected envelope or plaintext credential.
- The production route is fail-closed until a governed provider validator is deliberately injected. It cannot fake provider success or activate a credential by default.
- Validator output is strictly limited to a Boolean decision and sanitized evidence code. Malformed output becomes an internal failure and cannot activate the credential.
- Phase 2 reauthorizes the administrator and atomically compares the exact ID, company, provider, label, key version and pending state before recording an append-only administrative audit.
- Valid results atomically activate the credential and record `coordination_credential_activated`. Invalid results keep the credential pending and record `coordination_credential_validation_rejected`.
- A credential changed, revoked or otherwise made stale during the external validation window fails closed and creates no activation audit.
- Audit details contain provider, project ID, key version and evidence code only; no secret, envelope, provider error text or credential material is persisted.

## Verification

- Credential configuration service behavior: PASS.
- Coordination Hub runtime boundary behavior: PASS.
- API TypeScript check: PASS.
- Valid activation and append-only audit: PASS.
- Rejected validation remains pending and is audited: PASS.
- Already-active replay bypasses the validator and is idempotent: PASS.
- Validator input contains no envelope or ciphertext field: PASS.
- Configuration digest is a lowercase 64-character SHA-256 value: PASS.
- Invalid validator evidence contract fails closed: PASS.
- Concurrent revocation/change fails closed with zero activation audit: PASS.
- Default production validator returns a sanitized 503 and cannot activate: PASS.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`CREDENTIAL_DECRYPTION_IMPLEMENTED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next backend build may implement the first governed provider-validation adapter behind this port. It must preserve the no-secret-output boundary, use only a dedicated protected credential resolver, remain disabled without explicit provider configuration and avoid every MAIN04-owned frontend path.
