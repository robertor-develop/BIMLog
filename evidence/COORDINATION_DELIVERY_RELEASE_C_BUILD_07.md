# Coordination Delivery Release C — Build 07

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 07 defines and proves the canonical cryptographic protocol for protected SharePoint connector credentials. It does not connect the protocol to the database or runtime lease resolver, create a real credential, contact Microsoft, or activate a connector. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program; no frontend, Native or Lens Next source was touched.

## Task lock

- `OBJECTIVE=canonical connector credential envelope cryptographic protocol`
- `ALLOWED_LAYER=pure Platform cryptographic contract and focused tests only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, database/schema, existing stored envelopes, runtime resolver, real credentials, provider network, live database, publication and deployment`
- `STOP_CONDITION=round-trip, authenticated-context, canonical-encoding, tamper, rotation, missing-key and memory-clearing proofs pass`

## Canonical protocol

- Schema identity: `bimlog.connector-credential-envelope.v1`.
- Payload identity: binary prefix `BIMLOG-CONNECTOR-BEARER-V1` followed by the raw leased bearer-token bytes. Token length is bounded to 16–8,192 bytes.
- Secret encryption: AES-256-GCM with a fresh 32-byte data-encryption key and fresh 12-byte IV.
- Data-key wrapping: AES-256-GCM with a connector-specific 32-byte key-encryption key and a separate fresh 12-byte IV.
- Authentication tags are exactly 16 bytes. Wrapped data keys are exactly 32 bytes.
- Both GCM layers authenticate deterministic context containing schema, credential ID, company ID, provider, positive key version and distinct purpose (`secret` or `wrapped-data-key`).
- All persisted binary fields use canonical unpadded base64url. Padding, noncanonical alphabets, undeclared fields, malformed lengths and version disagreement fail with one fixed sanitized error.
- Runtime key naming is connector-specific: `BIMLOG_CONNECTOR_KEK_V{positive-version}`. The unrelated `AI_PROVIDER_KEK_*` authority is never accepted or reused.
- The key source exposes a short-lived mutable lease. KEK leases, plaintext payloads, unwrapped data keys, IV/tag/ciphertext decoding buffers and caller-supplied encryption token leases are cleared after use.
- Decryption returns a new mutable token buffer whose caller must clear after the bounded provider request.
- Key rotation is forward-compatible: new envelopes bind to a new positive key version, while retained prior keys can still decrypt earlier envelopes. A new-version key cannot decrypt an older envelope and context versions cannot be substituted.

## Verification

- Connector credential envelope cryptographic behavior: PASS.
- Protected SharePoint executor behavior: PASS.
- Coordination Hub runtime boundary behavior: PASS.
- API TypeScript check: PASS.
- Encryption/decryption round trip: PASS.
- No plaintext token in serialized envelope: PASS.
- Credential ID substitution rejection: PASS.
- Company ID substitution rejection: PASS.
- Key-version substitution rejection: PASS.
- Tamper rejection for every ciphertext, IV, tag and wrapped-key field: PASS.
- Padded/noncanonical base64url rejection: PASS.
- Unknown-field rejection: PASS.
- Missing/wrong KEK rejection with fixed sanitized error: PASS.
- Prior/new key-version rotation compatibility: PASS.
- Caller token lease cleared after encryption success/failure: PASS.
- KEK lease cleared after use: PASS.
- Connector-specific KEK namespace and no AI-key reuse: PASS.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_CREATED_OR_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`RUNTIME_DATABASE_RESOLVER_IMPLEMENTED=NO`

`EXISTING_ENVELOPE_MUTATION=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next backend build may implement the same-company, exact-state PostgreSQL credential lease resolver using this protocol. It must retrieve only the requested SharePoint envelope, require `pending_validation` for validation leases, decrypt outside the database transaction, pass only a mutable token lease to the fixed executor and clear all selected/decrypted material after use.
