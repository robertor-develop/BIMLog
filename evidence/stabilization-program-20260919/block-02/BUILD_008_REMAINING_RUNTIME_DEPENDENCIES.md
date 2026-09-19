# Build 008 — remaining runtime dependency correction

Date: 2026-09-19 UTC
Program branch: `codex/bimlog-stabilization-program-20260919`
Starting commit: `2c1c7990`
Result: `FAIL_FIXED_AND_RETESTED`

## Objective

Remove the remaining production advisories from image, temporary-file, mail/form-data, watcher, document-ID, database, storage-ID, and explicit AI-assistance paths.

## Changes

- Upgraded `sharp` to 0.35.4, `drizzle-orm` to 0.45.2, and `@anthropic-ai/sdk` to 0.91.1.
- Locked patched transitive closures: `form-data` 4.0.6, `nanoid` 5.1.16, `picomatch` 2.3.2, `tmp` 0.2.7, and `uuid` 11.1.1.
- Reconciled the SendGrid transport caller inventory with the existing governed Feedback copy route and both existing Project Directory membership-notification branches.
- Database/schema/customer data/provider/Native/installer effects: none.

## Actual failures and corrections

The first audit after installing `tmp` 0.2.6 exposed a newer type-confusion/path-traversal advisory whose patched floor is 0.2.7. The override was corrected to 0.2.7 and the frozen install and audit were repeated.

The SendGrid transport test then exposed a stale caller inventory: it expected one Project Directory call although two governed branches exist, and omitted the existing Feedback copy route. The inventory—not product mail behavior—was corrected and the complete transport suite was repeated.

The storage-adapter suite's first sandboxed launch could not create its isolated temporary F-root proof directory. The same existing test was rerun with its required filesystem access and passed 19/19; no production storage or customer data was touched.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Frozen install | PASS | exact lockfile installed with pnpm 11.17.0 |
| Production advisory audit | PASS | 0 critical, 0 high, 0 moderate, 0 low |
| Image/document inspection | PASS | post-P17 intake inspection and RFI complete-package behavior |
| Durable storage adapter | PASS | 19/19 dynamic checks in isolated temporary custody |
| Sync Agent watcher | PASS | Chokidar watcher open/close with patched Picomatch |
| SendGrid transport | PASS after inventory correction | 27 checks, 5 fixture provider contacts, 0 proxy contacts |
| API typecheck | PASS | exact Build 008 source |

## Position

- Completed builds: 8 of 120
- Remaining builds: 112
- Unpublished builds: 8 of maximum 10
- Next build: 009 — package provenance, package-manager identity, and forbidden-install enforcement
- Next push: Build 010
- Next publication and authenticated Chrome smoke: Build 010
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
