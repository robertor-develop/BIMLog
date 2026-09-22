# EDT and Engine Templates — Block 5 Acceptance

Builds: 296–300  
Date: 2026-09-22  
State: PASS_LOCAL_PUSH_DUE  
Publication: NOT_DUE_UNTIL_BUILD_305

## Accepted builds

- Build 296: server-resolved company/project/role/permission route authority and capability discovery.
- Build 297: activation request and approval routes bound to authenticated authority.
- Build 298: governed change request and decision routes with typed action/outcome validation.
- Build 299: immutable Economic Plan and time-entry transition routes; Economic Plan creation now requires `JOB_OPERATE`.
- Build 300: Work Item issuance, QC decision and `Result` import-preview routes plus consolidated route acceptance.

## Corrected finding

The integration review found governed-change and economic/time record reads that bound project but not stored company. The accepted implementation binds both company and project before mutation. Cross-company identity remains fail-closed.

## Gates

- `pnpm run test:edt-engine-block05`: PASS
- Prior service regression (`test:edt-engine-build293`): PASS
- `pnpm run typecheck`: PASS
- `pnpm run check:mojibake`: PASS
- Full repository production build and runtime closure: PASS
- Production database changed: NO
- Production publication: NOT DUE
- Lens Next Native/installer changed: NO
- Focused Navisworks smoke: NOT APPLICABLE

## Boundary

This block exposes backend operations only. It does not claim complete UI execution or final EDT end-to-end acceptance. Builds 301–305 own the next approved integration block and scheduled publication boundary.
