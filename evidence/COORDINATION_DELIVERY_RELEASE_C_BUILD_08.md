# Coordination Delivery Release C — Build 08

Date: 2026-09-09

## Result

`RESULT=PENDING_VERIFICATION`

Build 08 implements the same-company, exact-state PostgreSQL credential lease resolver for SharePoint validation. It composes the sealed Build 07 envelope protocol with the fixed protected provider executor. It does not create or read a real credential, contact Microsoft, change schema, apply a migration or activate a connector. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program; no frontend, Native or Lens Next source is in scope.

## Task lock

- `OBJECTIVE=same-company exact-state PostgreSQL SharePoint credential lease resolver`
- `ALLOWED_LAYER=Platform credential selection, protected decryption lease and focused tests only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, database/schema, credential registration/finalization logic, real credentials, provider response content, live database, publication and deployment`
- `STOP_CONDITION=exact SQL scope, transaction closure, decryption ordering, denial, sanitization and memory-clearing proofs pass`

## Contract

- The runtime resolver accepts only a strict SharePoint request containing credential ID and positive company ID.
- PostgreSQL selection is one explicit allowlisted projection. It binds `id`, `company_id`, `provider='sharepoint'` and `state='pending_validation'`; there is no generic `SELECT *`, alternate provider or active-credential fallback.
- Selection runs in a repeatable-read, read-only transaction. The transaction commits and the client releases before the KEK is leased or the credential envelope is decrypted.
- Persisted protected-envelope text is selected as mutable PostgreSQL byte buffers. Selected buffers are cleared after acquisition succeeds or fails.
- The Build 07 authenticated context binds credential ID, company ID, provider and key version during decryption.
- Only the newly decrypted mutable bearer-token buffer enters the bounded provider operation, and it is cleared whether that operation succeeds or fails.
- Missing, ambiguous, wrong-company, wrong-state, malformed or undecryptable records fail with one fixed sanitized unavailable error.
- Runtime SharePoint validation now composes this resolver; provider validation remains disabled unless its existing explicit environment and company-approval gates permit it.

## Verification

- PostgreSQL credential lease resolver behavior: PENDING.
- Connector credential envelope behavior: PENDING.
- Protected SharePoint executor behavior: PENDING.
- Coordination Hub runtime behavior: PENDING.
- Full production build: PENDING.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=PENDING`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_CREATED_OR_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`
