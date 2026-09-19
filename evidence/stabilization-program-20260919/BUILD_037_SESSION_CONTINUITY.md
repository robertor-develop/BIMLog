# Build 037 - Session continuity

Date: 2026-09-19  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `e31dc9cb`  
Result: `PASS`

## Objective

Make login, logout, refresh, expiration, clean restoration, and multi-tab session changes deterministic so stale asynchronous responses cannot overwrite a newer valid session or revive a logged-out browser.

## Changes

- Bound each issued JWT to millisecond session issuance identity.
- Rejected expired or malformed persisted sessions during restoration.
- Added monotonic session selection and cross-tab storage-event synchronization.
- Added deterministic out-of-order, expiration, logout, restoration, and serialization regressions.
- No database, provider, Native, installer, or customer-data mutation occurred.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Deterministic session suite | PASS | `pnpm --filter @workspace/api-server run test:session-continuity` |
| API type safety | PASS | `pnpm --filter @workspace/api-server run typecheck` |
| Browser type safety | PASS | `pnpm --filter @workspace/bimlog run typecheck` |

## Position

- Completed builds: `37 of 120`
- Remaining builds: `83`
- Unpublished builds: `7 of maximum 10`
- Next build: `038 - privileged route authority`
- Next push: `Build 040`
- Next publication and authenticated Chrome smoke: `Build 040`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
