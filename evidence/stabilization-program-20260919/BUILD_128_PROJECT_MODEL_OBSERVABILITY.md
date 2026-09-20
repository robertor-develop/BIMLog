# Build 128 — project/model-binding observability

Status: `PASS`

- Lens Next bridge JSON failures and probe failures now emit bounded diagnostic codes.
- A 401 renewal emits a code-only renewal marker, preserves the same request body/idempotency key, and retries once with the renewed token.
- Diagnostics exclude token, bridge URL, response body, project identity, model fingerprint, and customer content.
- No Native, installer, bridge protocol, or package behavior changed.
