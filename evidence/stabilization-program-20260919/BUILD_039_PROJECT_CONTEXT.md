# Build 039 - Tenant, company, and project context truth

Date: 2026-09-19  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `17e81c24`  
Result: `PASS`

## Objective

Keep exact project membership, truthful zero-project headquarters state, and global Super Administrator scope distinct while preventing prior-account aggregate data from surviving an account/context switch.

## Changes

- Added exact active project IDs and roles to the server-derived access profile.
- Bound every project workspace route to exact current membership or explicit global Super Administrator scope.
- Added truthful zero-project and out-of-scope project states.
- Cleared dashboard aggregates immediately when the current account has zero projects, closing a real stale cross-account display risk.
- No schema, provider, Native, installer, or customer-data mutation occurred.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Project-context decisions | PASS | `pnpm --filter @workspace/api-server run test:project-context` |
| Route/context source contract | PASS | Ten project routes use the exact context wrapper |
| API/browser type safety | PASS | API and BIMLog typechecks |

## Position

- Completed builds: `39 of 120`
- Remaining builds: `81`
- Unpublished builds: `9 of maximum 10`
- Next build: `040 - authenticated browser release gate`
- Next push: `Build 040`
- Next publication and authenticated Chrome smoke: `Build 040`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
