# Build 084 — Portable exports and manifests

Date: 2026-09-20  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `01234360`  
Result: `PASS`

## Objective

Create independently readable CSV, XML, ZIP, manifest, and SHA-256 handover artifacts from the exact selected record set.

## Changes

- Added one deterministic handover-package builder accepting the caller's exact filtered record set.
- Added spreadsheet-injection-safe CSV and escaped UTF-8 XML registers.
- Added canonical JSON manifest records and hashes for registers and included source bytes.
- Added strict duplicate-ID, metadata, size, and content-hash verification before archive creation.
- No database schema, provider, Native, installer, or customer-data mutation occurred.

## Verification

`tsx artifacts/api-server/src/lib/block17-build084-portable-exports.behavior.ts`

## Position

- Completed builds: `84 of 120`
- Remaining builds: `36`
- Unpublished builds: `4 of maximum 10`
- Next build: `085 — Owner handover acceptance and push`
- Next push: `Build 085`
- Next publication and authenticated Chrome smoke: `Build 090`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
