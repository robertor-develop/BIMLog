# Coordination Delivery Release C — Build 05

Date: 2026-09-09

## Result

`RESULT=PASS`

Build 05 adds the first governed SharePoint credential-validation adapter behind Build 04's two-phase activation boundary. It remains deliberately unable to contact Microsoft Graph until a separate protected request executor is implemented and configured. MAIN04 retains exclusive ownership of the BIMLog UX-compliance program; no frontend, Native or Lens Next source was touched.

## Task lock

- `OBJECTIVE=governed metadata-only SharePoint validation adapter`
- `ALLOWED_LAYER=Platform provider policy, validation adapter, route composition and focused tests only`
- `FROZEN_COMPONENTS=all frontend/UI, Job Intake UX, Lens Next, Native/Navisworks, MAIN04 worktrees, database/schema, stored credential envelopes, real provider network, live database, publication and deployment`
- `STOP_CONDITION=company approval, fixed-origin request, protected-executor isolation, provider-status classification and fail-closed runtime proofs pass`

## Implemented contract

- SharePoint validation is a governed provider operation and requires an exact company-scoped `sharepoint:validate` or `sharepoint:*` approval token.
- Runtime validation additionally requires `BIMLOG_SHAREPOINT_VALIDATION_ENABLED=true`.
- The only accepted origin is exactly `https://graph.microsoft.com`; alternate or malformed origins fail closed.
- The adapter's probe is fixed to `GET https://graph.microsoft.com/v1.0/sites/root?$select=id`, refuses redirects, uses a 10-second bound, requests JSON and limits the protected response boundary to 4,096 bytes.
- The adapter cannot call `fetch`, decrypt credentials or construct an authorization header. It delegates the fixed probe to a separate protected executor using only credential ID, company ID, provider and bounded request metadata.
- The configuration digest is validated locally but is not sent to the protected executor.
- The protected executor result accepts only HTTP status and an optional sanitized provider request ID. Response bodies or undeclared fields fail closed and cannot cross into the activation service.
- HTTP 200 returns `SHAREPOINT_GRAPH_AUTHORIZED`.
- HTTP 401, 403 and 404 return fixed sanitized rejection codes; no provider body or exception text is exposed.
- HTTP 408, 425, 429 and supported 5xx responses are temporary unavailability and cannot reject or activate the credential.
- Unknown statuses, unsafe executor failures, missing company approval, disabled validation, unsupported providers and absent protected executor all fail closed.
- Runtime composition now installs this adapter, but its protected executor intentionally remains unavailable. Therefore local source contains no real provider or credential-access capability and production cannot contact Microsoft Graph from this build alone.

## Verification

- SharePoint validator behavior: PASS.
- Existing protected configuration behavior: PASS.
- Coordination Hub runtime boundary behavior: PASS.
- Provider-governance authorization/disclosure checks: PASS.
- API TypeScript check: PASS.
- Exact company approval and cross-company denial: PASS.
- Fixed Graph origin/path/method/redirect/timeout/response bound: PASS.
- No secret, envelope or configuration digest crosses the executor boundary: PASS.
- Permanent versus temporary status classification: PASS.
- Provider body rejection: PASS.
- Provider exception sanitization: PASS.
- Default runtime cannot contact a provider: PASS.
- Frontend diff: ZERO.
- Native/Lens Next diff: ZERO.
- Database/schema diff: ZERO.

## Boundary

`LOCAL_BACKEND_BUILD_READY=YES`

`MAIN04_UI_OVERLAP=ZERO`

`REAL_CREDENTIAL_ACCESSED=NO`

`PROVIDER_NETWORK_ACCESSED=NO`

`PROTECTED_EXECUTOR_IMPLEMENTED=NO`

`LIVE_DATABASE_APPLICATION=NOT_EXECUTED`

`PUSH=NOT_EXECUTED`

`DEPLOYMENT=NOT_EXECUTED`

The next backend build may implement the protected request executor that resolves one exact active validation lease, performs the fixed HTTPS request and destroys transient authorization material. It must not add a general-purpose URL fetcher, return provider bodies, log credentials, broaden provider approvals or touch MAIN04-owned frontend paths.
