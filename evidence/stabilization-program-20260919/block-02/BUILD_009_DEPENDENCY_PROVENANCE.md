# Build 009 — dependency provenance and install-policy enforcement

Date: 2026-09-19 UTC
Program branch: `codex/bimlog-stabilization-program-20260919`
Starting commit: `0d6c2a3f`
Result: `PASS`

## Objective

Make the corrected dependency state reproducible and fail closed when package-manager identity, lockfile integrity, install-script authority, minimum release age, alternate locks, or the production advisory audit diverges.

## Changes

- Bound the governed local/CI toolchain to exact `pnpm@11.17.0` and the Replit builder to the explicit compatible range `>=10.26.1 <12`. Replit publication proved that its provider bootstrap misinterprets `packageManager` as a self-install request and that its supported pnpm 10.26.1 rejects an 11.17.0-only engine. The provider-triggering field is prohibited while both toolchain contracts, lockfile v9, integrity bindings, and audit gates remain enforced.
- Added `check:dependency-provenance`, which verifies pnpm identity, lockfile v9, frozen integrity entries for all 15 corrected resolutions, the one-day minimum release age, the exact native install-script allowlists, peer-install policy, and absence of npm/yarn lockfiles.
- Added `audit:production` at audit level low and placed both provenance and advisory checks at the beginning of `gate:pre-push`.
- Preserved the existing preinstall rejection for package managers other than pnpm.
- Database/schema/customer data/provider/Native/installer effects: none.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Frozen install | PASS | lockfile unchanged and exact under pnpm 11.17.0 |
| Provenance contract | PASS | 15 corrected resolutions and 980 integrity-bound resolutions checked |
| Alternate lockfiles | PASS | zero package-lock/yarn lock files |
| Install-script authority | PASS | exact `allowBuilds` and `onlyBuiltDependencies` lists |
| Minimum release age | PASS | 1,440 minutes |
| Production advisory gate | PASS | no known vulnerabilities at audit level low |

## Position

- Completed builds: 9 of 120
- Remaining builds: 111
- Unpublished builds: 9 of maximum 10
- Next build: 010 — full security regression, block closure, push, Replit publication, and authenticated Chrome smoke
- Next push: Build 010
- Next publication and authenticated Chrome smoke: Build 010
- Focused Navisworks smoke required: `NO`
- Blocker: `NONE`
