# Coordination Delivery Release C — Build 10

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 10 defines the server-side SharePoint credential-enrollment boundary. The authenticated route no longer trusts a client-authored encrypted envelope; it accepts one canonical base64url token, converts it to a short-lived mutable lease, encrypts it under the server-held connector KEK and sends only the sealed envelope to the existing pending-registration authority. No real credential, provider request, schema change or frontend work is included. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program.

## Task lock

- `OBJECTIVE=server-side SharePoint credential enrollment into the sealed connector envelope`
- `ALLOWED_LAYER=Platform request decoding, protected encryption composition, route wiring and focused tests only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, schema, credential validation/finalization, real credentials, provider network, live database, publication and deployment`
- `STOP_CONDITION=canonical input, server-owned key version, envelope-only registration, client-envelope rejection and token-clearing proofs pass`

## Contract

- The project-admin credential route accepts a nested `tokenBase64Url` only as canonical unpadded base64url representing 16–8,192 bytes.
- The encoded request field is removed from the request object immediately after decoding. The mutable decoded token is cleared after enrollment succeeds or fails.
- The active positive key version comes only from `BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION`; the client cannot choose it.
- Encryption uses the Build 07 connector-specific KEK source and authenticated credential/company/provider/key-version context.
- The existing registration service receives only metadata plus the sealed envelope and creates the same `pending_validation` record. Client-authored envelope fields are rejected by the strict enrollment contract.
- Responses contain only registration result, credential ID and pending state. Tokens, envelopes, keys and configuration digests are never returned or logged.

## Verification

- Server-side enrollment behavior: PASS.
- Connector envelope round trip: PASS.
- Client-authored envelope rejection: PASS.
- Token clearing on success/failure: PASS.
- Coordination Hub runtime behavior: PASS.
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

The next backend build may implement an explicit, compare-and-set credential rotation command that creates a new sealed envelope under a newer active connector key version while preserving validation state transitions and audit evidence. It must not overwrite a credential silently or use a real token without a separate action-time gate.
