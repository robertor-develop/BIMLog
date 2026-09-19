# Build 036 - Canonical authority matrix

Date: 2026-09-19  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `82b19f3f`  
Result: `PASS`

## Objective

Define one deterministic access matrix for Super Administrator, company PMO, project administrator, ordinary project member, zero-project user, explicit Living Brief grantee, and unauthenticated user states.

## Changes

- Added a pure, fail-closed access policy covering every privileged headquarters surface.
- Distinguished global Super Administrator scope, company PMO scope, project-administrator scope, ordinary project membership, explicit Living Brief grants, and truthful zero-project access.
- Added a deterministic matrix regression; no database, provider, Native, installer, or customer-data mutation occurred.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Focused authority matrix | PASS | `pnpm --filter @workspace/api-server run test:access-policy` |
| Type safety | PASS | `pnpm --filter @workspace/api-server run typecheck` |
| Direct/visible policy parity foundation | PASS | Every access surface resolves from the same pure policy |

## Position

- Completed builds: `36 of 120`
- Remaining builds: `84`
- Unpublished builds: `6 of maximum 10`
- Next build: `037 - session continuity`
- Next push: `Build 040`
- Next publication and authenticated Chrome smoke: `Build 040`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
