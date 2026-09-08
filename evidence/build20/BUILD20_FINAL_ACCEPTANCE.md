# Build 20 — Job Intake / Multi-APU final internal acceptance

Date: 2026-09-08

## Scope

This checkpoint reconciles the original 20-row smoke-test workbook against the coherent Build 2–19 implementation lineage. It does not publish, deploy, mutate production data, or claim customer field acceptance.

## Evidence

- All 20 workbook rows are mapped individually to current-lineage implementation and focused behavior evidence in `BIMLog_Smoke_Test_Project_Intake_APUs_BUILD20_FINAL.xlsx`.
- The combined controlled scenario passes with 3 authoritative companies, 2 engagements, 3 contracts, 3 immutable APU versions, 3 work packages, 3 eligible resources, 180 planned hours, 180 assigned hours, and 100% financial setup.
- The combined scenario immutable commercial-baseline fingerprint is `214c6451a335d8010483e2c2bc331bc52e6402747f82c67ab623c3b44ea5b3cc`.
- `pnpm --filter @workspace/api-server run test:generic-apu` passes, including Generic APU, Job Intake, contracts, work packages, budget, project controls, team planning/performance, help, API typecheck, and frontend typecheck.
- The original workbook is unchanged. The Build 20 workbook preserves its original observations in columns D/E and adds final result/evidence in columns F/G.

## Boundaries

- Database changed: no.
- Schema changed: no.
- Publication/deployment: no.
- Production/customer data used: no.
- External field acceptance: not claimed.

## Decision

The controlled internal Job Intake / Multi-APU recovery denominator is closed. The coherent source is eligible for release-candidate preparation, subject to the separately authorized publication, deployment, production mutation, and customer-acceptance gates.
