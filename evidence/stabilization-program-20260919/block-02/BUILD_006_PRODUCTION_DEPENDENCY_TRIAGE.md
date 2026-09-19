# Build 006 — production dependency advisory triage

Date: 2026-09-19 UTC
Program branch: `codex/bimlog-stabilization-program-20260919`
Starting commit: `115b42b4f309f6daeb1249db0c9634da558f116b`
Result: `PASS`

## Objective

Inventory the exact frozen production dependency closure and classify every advisory by runtime path and correction owner before changing package versions.

## Baseline

`pnpm audit --prod --json` against pnpm 11.17.0 and Node 24.11.1 reported 34 advisories across 448 production/optional dependencies: 20 high, 12 moderate, 2 low, and 0 critical. Every finding is lockfile-backed and all 34 are accounted for below.

| Package / installed version | Advisories | Runtime path | Reachability / risk | Build owner |
|---|---:|---|---|---:|
| `multer@2.2.0` | 4 | API multipart upload middleware | Directly reachable through governed upload routes; DoS, descriptor leak, and limit-race findings | 007 |
| `adm-zip@0.5.16` | 3 | API and workspace archive processing | Direct archive parser; memory allocation and symlink-following findings | 007 |
| `path-to-regexp@8.3.0` | 2 | Express router | Request-routing reachable; ReDoS/DoS findings | 007 |
| `qs@6.15.0` | 3 | Express/body-parser | Request parsing/stringification closure; DoS findings | 007 |
| `body-parser@2.2.2` | 1 | Express body parser | Request parsing; invalid limit can disable enforcement | 007 |
| `brace-expansion@1.1.12/2.0.2` | 8 | Archiver/ExcelJS glob closure | Export/archive runtime closure; attacker-controlled glob reachability is bounded, but resource-exhaustion closure remains production-shipped | 007 |
| `lodash@4.17.23` | 2 | Archiver utilities | Export/archive runtime closure; vulnerable template/unset primitives are not called directly by BIMLog, but remain shipped | 007 |
| `sharp@0.35.3` | 1 | API image processing | Direct image parser; malformed image memory-safety risk | 008 |
| `tmp@0.2.5` | 1 | ExcelJS | Spreadsheet import/export closure; caller-controlled prefix/postfix is not exposed directly, but the vulnerable runtime is shipped | 008 |
| `form-data@4.0.5` | 1 | SendGrid client | Outbound mail closure; governed values reduce exposure, but CRLF-sensitive multipart serialization remains shipped | 008 |
| `uuid@8.3.2/9.0.1` | 1 | ExcelJS and Replit object storage | Buffer-output APIs are not called directly by BIMLog; still part of document/storage runtime closure | 008 |
| `picomatch@2.3.1` | 2 | Sync Agent chokidar | Local watcher glob matching; user-controlled watch patterns make ReDoS relevant | 008 |
| `nanoid@5.1.7` | 2 | DOCX | Non-secure negative-size generators are not called by BIMLog, but vulnerable closure is shipped | 008 |
| `drizzle-orm@0.45.1` | 1 | API/database library | Direct core dependency; identifier injection risk is high impact even though BIMLog does not intentionally accept raw identifiers | 008 |
| `@anthropic-ai/sdk@0.79.0` | 2 | explicit AI assistance | SDK is direct; affected local filesystem memory-tool APIs are not used by BIMLog, but the version remains production-shipped | 008 |

Total classified: 34 advisories. No advisory was dismissed solely because it was transitive. The correction strategy is bounded package upgrades and exact transitive overrides, followed by frozen-install, focused behavior, full build, production-artifact closure, and zero-advisory audit proof.

## Effects

- Product source changed: no.
- Dependency versions changed: no; this build establishes the frozen baseline.
- Database/schema/customer data: unchanged.
- Provider configuration: unchanged.
- Native/installer: unchanged; focused Navisworks smoke not required.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Frozen production audit | PASS | 34 = 20 high + 12 moderate + 2 low; 0 critical |
| Advisory accounting | PASS | All IDs grouped by exact package, installed version, path, and build owner |
| Runtime-path review | PASS | API, export/archive, document/image, mail/storage, AI, and Sync Agent closures distinguished |
| Working tree before evidence | PASS | Clean at exact pushed Build 005 head |

## Position

- Completed builds: 6 of 120
- Remaining builds: 114
- Unpublished builds: 6 of maximum 10
- Next build: 007 — HTTP, upload, and archive dependency correction
- Next push: Build 010
- Next publication and authenticated Chrome smoke: Build 010
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
