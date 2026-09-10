# UX Less-Is-More Program — Build 1 Baseline

Date: 2026-09-09
Source base: `e54b0375d200e59275144a3a9c2fe633aa5043f4`
Live version observed: `v1.05.N17-P12`
Live route observed: `https://bimlog.app/dashboard`

## Immutable program contract

- Reduce simultaneous cognitive load; do not remove capability.
- Preserve business logic, permissions, database/schema, records, exports, reports, and module availability.
- Secondary actions may move behind progressive disclosure, tabs, menus, accordions, or advanced panels only when their discoverability and behavior remain proven.
- Do not redesign an established workflow unless a separately reproduced defect requires it.
- Every affected screen must be checked in applicable populated, empty, loading, error, denied, disabled, and permission-limited states; desktop and exact 390 px; English and Spanish where localized.
- Each later micro-build must list the capability inventory before and after. A missing capability is a failure.

## Frozen capability inventory

The following customer capabilities were found in the current source route map and are protected from disappearance:

1. Public landing, sign-in, registration, password reset, pricing, features, about, contact, privacy, terms, disclaimer, and retention.
2. Headquarters dashboard, global search, notifications, profile, language, theme, Help, and session controls.
3. Project creation, project list, active-state filtering, sorting, current-view PDF, AI briefing, portfolio indicators, pending-work navigation, and recent activity.
4. Project workspace and its current modules, including Files, Clash Reports, Lens Next, RFIs, Submittals, Transmittals, Change Orders, Meetings, Schedule, Reports, Analytics, Team, Commercial, and settings/administration surfaces where entitled.
5. Job Intake two-minute default path and Advanced Setup, ordered draft save/reload, project identity, authoritative companies and contacts, engagements, contracts, Contract Items, APU/pricing selection and history, delivery flow, work packages, assignments, activation, readiness/progress, and governed PDF.
6. Job Operations, Cost & Value Planner, Budget, Contracts, Generic APU, Team Performance, and their existing history/export/report behavior.
7. Administration, Total Control, Living Brief, Feedback, company profile, notifications, and financial controls subject to existing authorization.
8. Lens Next create/open/refresh, RFI and Submittal links, reference attachments, XML export, Help & Guide, project/model isolation, and diagnostic-control exclusion.

## Live dashboard observation

The authenticated production dashboard rendered successfully in Spanish with version `v1.05.N17-P12`.

- Accessibility tree: 157 indexed nodes (`0` through `156`).
- Dashboard-visible button nodes: 20, excluding select popup controls.
- Current top-level facts: 4 projects, 16 processed files, 11 open RFIs, 1 pending Submittal, 1,436 clashes, and 32 open clashes.
- Eight portfolio KPI cards are simultaneously visible before the project list.
- Search, project-state filter, sort, clear filters, Print PDF, AI briefing, New Project, four project delete controls, Help, sidebar administration controls, account/session actions, notifications, theme, language, and feedback are all exposed on the same page.
- No browser error or failed-page state was visible during the observation.

This confirms the audit finding: the dashboard has broad useful capability, but presents a high amount of simultaneous information and action density.

## Source architecture observation

- `artifacts/bimlog/src/App.tsx` eagerly imports 30 page modules and declares 30 route entries including the fallback route.
- The authenticated product uses one large top-level route graph rather than route-level lazy loading.
- `JobIntakeWorkspace.tsx` contains the simple path and Advanced Setup in one production component and already provides a safe architectural basis for progressive disclosure without creating a second Intake authority.
- Existing responsive and Help patterns are present and must be reused, not replaced.

## Existing production payload baseline

Prior live audit measurements retained for comparison:

- Main JavaScript payload: approximately 3,200,164 bytes.
- Main CSS payload: approximately 159,759 bytes.
- Feedback widget payload: approximately 78,743 bytes.
- Observed document timing: approximately 1,054 ms cold and 384–469 ms warm.

These measurements are comparison baselines, not arbitrary pass/fail thresholds. Build 9 will establish and verify the bounded route-splitting change against them.

## Twelve-build controlled sequence

### Release group A — hierarchy, navigation, Intake

1. Baseline and capability lock (this build).
2. Headquarters/dashboard hierarchy.
3. Global navigation and action hierarchy.
4. Job Intake progressive disclosure.

### Release group B — project UI, tables, mobile

5. Project overview hierarchy.
6. Shared table density and row-action consistency.
7. Form typography, spacing, and guidance density.
8. Exact 390 px responsive correction across affected families.

### Release group C — accessibility, performance, final acceptance

9. Route splitting and JavaScript payload reduction.
10. Keyboard, focus, semantic, contrast, and state accessibility.
11. Public-site authentic product proof and cross-surface consistency.
12. Capability-preservation matrix, bilingual desktop/mobile acceptance, performance comparison, full regression, and release-candidate evidence.

Publish/deploy is not implicit in any build. The planned publish review points are after Builds 4, 8, and 12, and require Roberto's separate explicit publication authorization.

## Build 1 result

Result: PASS — baseline and capability denominator frozen.

Product code changed: NO
Business logic changed: NO
Permissions changed: NO
Database changed: NO
Schema changed: NO
Deployment changed: NO

