# Build 005 — program control and first push boundary

Date: 2026-09-19 UTC
Program: BIMLog stabilization, completion, and release program — 120 builds
Branch: `codex/bimlog-stabilization-program-20260919`
Authoritative base: `07d024ef3de739abb436da58fe29797af5304b8a`

## Result

Build 005 and Block 01 passed. The durable program ledger, templates, evidence inventory, and exact identity verifier are present. The branch was pushed normally without force. No production publication was due or performed.

## Exact validated product candidate

- Full clean pre-push gate head: `eda9c85b4aed17c0d28731d4074beafe5a5936ec`
- Secret exposure: PASS
- Database source safety: PASS — 223 tables, 273 indexes, 184 startup tables reconciled
- Artifact fixture: PASS — loopback UTF-8 `bimlog_rfi_test`, private F-rooted custody
- Mojibake: PASS
- Living Brief integrity: PASS — 11 documents, 38 internal links, 40 standards links
- Typechecks and workspace builds: PASS
- Deterministic runtime closure: PASS — 15 direct packages, 15 dependencies, 16,351 files
- Invalid storage authority: PASS — natural exit in 239.9 ms, no TCP listener or readiness
- Valid packaged runtime: PASS — application readiness 5,795 ms; wall readiness 7,405.3 ms
- Existing Windows timing budgets: unchanged and passing

## Defects corrected inside Build 005

1. Invalid durable-storage authority originally required 8,174–8,217 ms to fail. `dist/start.cjs` now rejects a bad authority hash before loading the large application graph.
2. A valid cold runtime could not answer liveness while its 5.7 MB graph loaded. Packaging now binds through the 13.1 KB `dist/index.cjs` bootstrap and defers the application to native-ESM `dist/app.mjs`.
3. Bundled CommonJS dependencies inside the ESM application receive a scoped `createRequire(import.meta.url)` bridge.
4. The PowerShell identity verifier now handles a single-line `git ls-remote` result as one line rather than one character.

## Push and live comparison

- Remote: `https://github.com/robertor-develop/BIMLog.git`
- Remote branch: `codex/bimlog-stabilization-program-20260919`
- Push method: normal, non-force
- Post-push identity: PASS; clean local and exact remote head match
- Production publication: NOT DUE — first publication boundary is Build 010
- Existing public root: HTTP 200
- Existing health: HTTP 200, `{"status":"ok"}`
- Production mutation: none
- Database/schema/customer-data mutation: none
- Native/installer change: none; focused Navisworks smoke not required for this block
- Full authenticated Chrome smoke: not required until the Build 010 publication

## Program position

- Completed: 5 of 120
- Remaining: 115
- Current unpublished builds: 5 of maximum 10
- Next build: 006 — production dependency advisory triage
- Next push: Build 010
- Next publication and full authenticated Chrome smoke: Build 010
- Blocker: none

The definitive final Block 01 branch head is the clean local/remote-matched commit containing this report and is recorded in MAIN-00's external closure receipt.
