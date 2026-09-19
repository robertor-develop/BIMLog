# Build 043 — Truthful route states

- Result: PASS
- Scope: loading, empty, denied, offline/unavailable, and error presentation for major authenticated route boundaries.
- Root cause corrected: access-profile and project-context transport failures were previously rendered as authorization denial.
- Correction: one accessible bilingual `RouteState` family now separates loading, denied, and service failure; failure states provide retry and headquarters actions without weakening access decisions.
- Verification: route-state behavior contract, lazy-route regression, project-workspace lazy regression, and BIMLog TypeScript check.
- Native/installer impact: none.
