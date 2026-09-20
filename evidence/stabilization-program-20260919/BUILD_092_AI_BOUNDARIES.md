# Build 092 — AI source and failure boundaries

- `createUntrustedPromptEnvelope` binds actor, allowed projects, bounded source size, source digest, and untrusted-data instructions.
- Cross-project sources and invalid actors fail closed before provider invocation.
- Parsed output permits only the requested shape; malformed JSON, unexpected fields, wrong date, excessive items, timeout, setup, quota, and provider errors receive explicit failure codes.
- No provider call is made by the dashboard briefing; its operational summary is deterministic and local.
