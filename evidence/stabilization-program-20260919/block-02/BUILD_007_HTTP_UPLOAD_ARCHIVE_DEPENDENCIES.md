# Build 007 — HTTP, upload, and archive dependency correction

Date: 2026-09-19 UTC
Program branch: `codex/bimlog-stabilization-program-20260919`
Starting commit: `43855166`
Result: `FAIL_FIXED_AND_RETESTED`

## Objective

Remove the highest-risk request-routing, multipart-upload, and archive/export advisories without broad framework churn.

## Changes

- Upgraded direct `multer` from 2.2.0 to 2.3.0 and `adm-zip` from 0.5.16 to 0.6.1.
- Pinned patched runtime closures: `body-parser` 2.3.0, `path-to-regexp` 8.4.0, `qs` 6.16.0, `brace-expansion` 1.1.18/2.1.4, and registry-published `lodash` 4.18.1.
- Preserved BIMLog's inclusive upload limits under Multer 2.3.0 with an exact post-parse byte guard. The parser receives one bounded sentinel byte; BIMLog rejects any parsed file or text field above the declared application limit before route mutation.
- Updated only manifests, lockfile, multipart boundary code, and this evidence.
- Database/schema/customer data/provider/Native/installer effects: none.

## Actual failure and correction

The first focused multipart run returned HTTP 200 for a nine-byte file against an eight-byte BIMLog limit after the Multer upgrade. Changing the parser limit directly to eight then rejected the valid exact-eight-byte boundary. The correction retained a one-byte parser sentinel and added explicit post-parse file/text byte enforcement. The repeated suite passed every inclusive and just-over-limit boundary, authorization-first rejection, malformed request, and concurrency check.

The first lock resolution also proved that advisory floor `lodash@4.17.24` was not registry-published. Resolution was corrected to the actual patched release `4.18.1`; no gate was relaxed.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Frozen install | PASS | pnpm 11.17.0 completed with exact lockfile |
| Multipart security | PASS after correction | valid-at-limit, 11 bounded rejections, 5 authorization gates, concurrent isolation, malformed recovery |
| API typecheck | PASS | `tsc -p artifacts/api-server/tsconfig.json --noEmit` |
| Archive/document behavior | PASS | feedback package, RFI complete package, financial budget export, and financial contract export suites |
| Production advisory reduction | PASS | 34 advisories reduced to 11; all remaining packages assigned to Build 008 |

## Position

- Completed builds: 7 of 120
- Remaining builds: 113
- Unpublished builds: 7 of maximum 10
- Next build: 008 — image, temporary-file, form-data, utility, database, and SDK dependency correction
- Next push: Build 010
- Next publication and authenticated Chrome smoke: Build 010
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
