# Build 123 — audit regression gate

Status: `PASS`

- `audit:platform:blocking` fails on any P0 or P1 identity absent from the accepted baseline.
- The identity self-test proves deterministic IDs plus unexpected/resolved reconciliation behavior.
- The policy test requires every scheduled P1 category to retain an owner, target build, and disposition.
