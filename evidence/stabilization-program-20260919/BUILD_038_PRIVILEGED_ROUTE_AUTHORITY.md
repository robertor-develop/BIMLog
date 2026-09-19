# Build 038 - Privileged route authority

Date: 2026-09-19  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `aea90be5`  
Result: `PASS`

## Objective

Bind Total Control, Living Brief, company catalogs, pricing, workflows, project administration, and feedback administration to one current server-derived authority profile.

## Changes

- Added a current database-backed access profile endpoint using active project membership, PMO grant, financial-administrator grant, explicit Living Brief grant, and Super Administrator state.
- Replaced token-only privileged route wrappers with explicit server-derived decisions and truthful bilingual denial.
- Bound sidebar visibility to the same decision profile, removing divergent ad-hoc project/catalog checks.
- No schema, provider, Native, installer, or customer-data mutation occurred.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Route/navigation authority contract | PASS | `pnpm --filter @workspace/api-server run test:access-route-authority` |
| Authority matrix regression | PASS | `pnpm --filter @workspace/api-server run test:access-policy` |
| API/browser type safety | PASS | API and BIMLog typechecks |

## Position

- Completed builds: `38 of 120`
- Remaining builds: `82`
- Unpublished builds: `8 of maximum 10`
- Next build: `039 - tenant/company/project context truth`
- Next push: `Build 040`
- Next publication and authenticated Chrome smoke: `Build 040`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
