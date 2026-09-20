# Build 082 — Upload, retention, and authorization contract

Date: 2026-09-20  
Program branch: `codex/bimlog-stabilization-program-20260919`  
Starting commit: `3f624231`  
Result: `PASS`

## Objective

Make project-file upload, download, retention, and deletion behavior fail safely.

## Changes

- Rejects empty, oversized, path-bearing, executable, and script uploads before durable storage.
- Preserves exact project membership plus project/file identity checks on download.
- Enforces metadata retention holds and removes stored bytes when an authorized deletion succeeds.
- Retains safe content disposition for arbitrary supported file types.
- No database schema, provider, Native, installer, or customer-data mutation occurred.

## Verification

`tsx artifacts/api-server/src/lib/block17-build082-upload-retention.behavior.ts`

## Position

- Completed builds: `82 of 120`
- Remaining builds: `38`
- Unpublished builds: `2 of maximum 10`
- Next build: `083 — Shared PDF/report fidelity`
- Next push: `Build 085`
- Next publication and authenticated Chrome smoke: `Build 090`
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
