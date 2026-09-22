# BIMLog EDT and Engine Templates — Block 2 acceptance

Date: 2026-09-22

Builds: 281–285

Result: `PASS_LOCAL`

Push boundary: due after Build 285

Publication boundary: due after Build 285 (ten-build boundary across Blocks 1–2)

## Accepted builds

- Build 281 defines the 15 approved granular EDT permission codes and rejects unknown grants.
- Build 282 provides optional BIMLog role profiles while enforcing permission, tenant, project,
  record eligibility, anti-self-approval, conflict and independent-approval checks.
- Build 283 exposes tenant-scoped lifecycle usage for Clients, Disciplines, Services and Phases
  without deleting or rewriting historical selections.
- Build 284 replaces the four-panel scrolling wall with a compact, accessible one-catalog-at-a-time
  administration surface and usage details beside the selected value.
- Build 285 executes the negative authorization matrix, accessibility contract and block gate.

## Scope truth

- Product behavior changed: `YES`
- Database/schema changed: `NO`
- Production database touched: `NO`
- Lens Next Native changed: `NO`
- Installer changed: `NO`
- Focused Navisworks smoke required: `NO`
- Publication due: `YES`

## Verification

Run `pnpm run test:edt-engine-block02`. Before publication, the normal production build and release
checks must also pass. After publication, run the full authenticated Chrome smoke against the live
Headquarters catalog administration and a downstream project selection path.
