# Build 022 — OPEN_LOOP disposition inventory

`scripts/open-loop-dispositions.mjs` inventories every unchecked item in `living-brief/OPEN_LOOP.md` and assigns exactly one allowed disposition:

- `ACTIVE`
- `SUPERSEDED`
- `ACCEPTED_LIMITATION`
- `CLOSED_WITH_EVIDENCE`

The generated `living-brief/OPEN_LOOP_DISPOSITIONS.json` binds each item to its heading, source line, statement fingerprint, disposition, and evidence. The check fails when the source changes without regeneration or any item lacks a disposition/evidence record.
