# Coordination Delivery Release C — Build 06

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 06 adds the protected SharePoint request executor behind Build 05's governed validator. The executor obtains one short-lived mutable bearer-token lease from a dedicated resolver, performs only the exact fixed Microsoft Graph validation probe and clears the leased bytes on every exit path. The runtime resolver remains deliberately unavailable because the connector envelope's canonical encryption/AAD protocol has not yet been established. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program; no frontend, Native or Lens Next source was touched.

## Task lock

- `OBJECTIVE=protected fixed-request SharePoint validation executor`
- `ALLOWED_LAYER=Platform protected-executor contract, runtime composition and focused tests only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, database/schema, stored credential envelopes, encryption format, real provider network, live database, publication and deployment`
- `STOP_CONDITION=fixed-request, lease-scope, body-discard, token-zeroization, timeout and sanitized-failure proofs pass`

## Implemented contract

- The executor accepts only a non-empty credential ID, positive company ID and provider `sharepoint`.
- It independently rechecks the exact request contract: `GET https://graph.microsoft.com/v1.0/sites/root?$select=id`, redirects refused, JSON accepted, 10-second timeout and a 4,096-byte maximum response boundary.
- It cannot accept a caller-selected origin, path, HTTP method, redirect policy, timeout or response limit.
- A dedicated `ProtectedBearerLeaseResolver` owns credential lookup/decryption. The executor receives only a short-lived mutable token byte lease inside a callback; no envelope fields cross the resolver boundary.
- The executor creates the authorization header only inside the lease callback, releases its local reference and zeroes the leased token bytes in `finally` on success, provider rejection, transport failure, cancellation failure or timeout.
- Response content is never read or returned. Any response body is immediately cancelled before metadata is accepted.
- Only an integer HTTP status and an optional syntactically safe Microsoft request ID can return to the validator.
- Invalid response metadata, response-discard failure and transport exceptions become fixed sanitized unavailability errors. Provider exception messages are not propagated.
- The executor performs no logging and persists no request, response, token or provider metadata.
- Runtime composition uses an unavailable resolver. Therefore even if validation and company approval environment flags are present, Build 06 cannot resolve a credential or initiate a real Microsoft request.
- A cryptographic resolver was intentionally not invented: the current connector envelope specifies fields and key version but does not yet define the canonical KEK identifiers, AES-GCM AAD values or credential payload schema.

## Verification

- Protected SharePoint executor behavior: PASS.
- SharePoint validator behavior: PASS.
- Coordination Hub runtime boundary behavior: PASS.
- API TypeScript check: PASS.
- Exact credential/company/provider lease request: PASS.
- Exact Graph URL/method/redirect/timeout/response bound: PASS.
- Successful response body cancellation: PASS.
- Invalid request variation rejected before lease/network: PASS.
- Token bytes zeroed after success: PASS.
- Token bytes zeroed after transport failure: PASS.
- Token bytes zeroed after response-cancellation failure: PASS.
- Invalid short lease rejected and zeroed: PASS.
- Unsafe provider request ID omitted: PASS.
- Provider exception text suppressed: PASS.
- Runtime real-network capability: ABSENT.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`CANONICAL_CREDENTIAL_RESOLVER_IMPLEMENTED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next backend build must define and prove the canonical connector-envelope cryptographic protocol before implementing the runtime resolver. It must use collision-specific key identifiers and authenticated context, support controlled key rotation, reject malformed/noncanonical base64url without revealing which field failed, and never reuse the unrelated AI-provider encryption authority.
