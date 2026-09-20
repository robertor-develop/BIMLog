# Build 098 — Safe observability

- Every HTTP response carries a validated or generated correlation ID.
- Structured completion logs contain only event, correlation ID, method, path, status, and elapsed milliseconds.
- Query strings, request bodies, credentials, cookies, authorization headers, and customer content are not logged.
- Invalid or attacker-controlled correlation IDs are replaced with UUIDs.
- Focused redaction test: `pnpm --filter @workspace/api-server run test:block20-build098`.
