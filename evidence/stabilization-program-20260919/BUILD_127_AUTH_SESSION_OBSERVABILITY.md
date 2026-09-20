# Build 127 — authentication/session observability

Status: `PASS`

- Connector lease and lifecycle rollback failures now emit bounded code-only operational events while preserving the original authoritative failure.
- Invalid configured public origins remain excluded and now emit `PUBLIC_ORIGIN_CONFIGURATION_INVALID` without echoing the configured value.
- Malformed persisted sessions and token claims emit code-only browser diagnostics; tokens and user records are never logged.
- Deterministic tests prove denial behavior, rollback continuation, exact event codes, and non-disclosure.
