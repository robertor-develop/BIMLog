# Build 081 — Governed arbitrary-file download

Date: 2026-09-20  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `dfb6b17e8683c629ea3a18bcc81838639071aba4`  
Result: `PASS`

## Objective

Restore truthful download continuity for ordinary customer uploads.

## Changes

- Accepted and naming-rejected upload records now retain the exact opaque durable-storage key.
- Existing project membership and project/file identity checks remain authoritative.
- Stored files continue through bounded storage retrieval, controlled media type, and safe RFC 5987 filename disposition.
- No database schema, provider, Native, installer, or customer-data mutation occurred.

## Verification

`pnpm --filter @workspace/api-server run test:block17-build081`

## Position

- Completed builds: `81 of 120`
- Remaining builds: `39`
- Unpublished builds: `1 of maximum 10`
- Next build: `082 — Upload and retention contract`
- Next push: `Build 085`
- Next publication and authenticated Chrome smoke: `Build 090`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
