# Build 032 - Deterministic approved proof roots

Date: 2026-09-19  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `eda2bd24`  
Result: `PASS`

## Objective

Give disposable feedback and workflow proofs one deterministic, bounded temporary-root contract without ad hoc filesystem permission changes.

## Changes

- Added a shared resolver rooted at `F:\BIMLog\TestProof\stabilization-program-20260919` on Windows and the operating-system temporary directory elsewhere.
- Purpose names are bounded; configured paths must remain beneath the approved base; link boundaries are rejected when directories are materialized.
- Database, provider, Native, installer, and customer-data effects: none.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Deterministic feedback root | PASS | `node scripts/test-proof-root.mjs` |
| Deterministic workflow root | PASS | Same test, disjoint purpose directory |
| Escape rejection | PASS | Traversal and outside-root fixtures rejected |
| Permission improvisation | REMOVED | No ACL mutation is part of root selection |

## Position

- Completed builds: `32 of 120`
- Remaining builds: `88`
- Unpublished builds: `2 of maximum 10`
- Next build: `033 - named workflow database fixture`
- Next push: `Build 035`
- Next publication and authenticated Chrome smoke: `Build 040`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
