# Build 085 — Owner handover acceptance and push boundary

Date: 2026-09-20  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `7e14d8eb`  
Result: `PASS`

## Objective

Build and inspect one complete owner handover package from controlled project records and close Block 17 at its push boundary.

## Changes

- Added an authenticated, project-member-bound owner handover ZIP route using the exact visible name/type/status/declaration filters.
- Requires every selected record to have durable bytes, size, and SHA-256 evidence; ambiguity fails closed with truthful guidance.
- Caps handover size, retrieves bytes through bounded storage, records the export, and returns archive/manifest hashes.
- Controlled two-file acceptance proved CSV/XML registers, manifest, exact source bytes, independent hashes, and tamper refusal.
- No database schema, provider, Native, installer, or customer-data mutation occurred.

## Verification

`tsx artifacts/api-server/src/lib/block17-build085-owner-handover-acceptance.behavior.ts`  
`test:block17-document-handover-acceptance`

## Position

- Completed builds: `85 of 120`
- Remaining builds: `35`
- Unpublished builds: `5 of maximum 10`
- Next build: `086 — NOT STARTED`
- Next push: `Build 090`
- Next publication and authenticated Chrome smoke: `Build 090`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
