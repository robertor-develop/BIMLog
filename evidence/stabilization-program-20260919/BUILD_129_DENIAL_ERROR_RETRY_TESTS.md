# Build 129 — denial, error, and retry tests

Status: `PASS`

- Credential denial remains fail-closed even when rollback itself fails.
- Session-storage corruption remains non-authoritative and observable without exposing stored content.
- Lens Next malformed-response probes return disconnected, report exact bounded codes, and disclose neither token nor loopback address.
- Session renewal retains stable mutation request identity and retries exactly once.
- Audit result: P0=0, P1 reduced from 66 to 61, root-cause groups reduced from 38 to 34, unexpected P1=0.
