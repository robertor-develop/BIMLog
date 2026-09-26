# C004 — required and received submittal identities

Baseline: 73a5a7d7d5bafbb74d8bfac123c896561a07666d. Date: 2026-09-26.
Scope: approved consolidation C004, independent of unresolved operational I010/C003 acceptance.

## Source change

The tracking page previously read only packages and returned an empty state when there were none. It never read the required-submittal register despite promising combined tracking. The existing tracking view now includes an explicit requirement/package coverage panel. Existing register and package records remain the sole authorities; existing linked_items persists their relationship. No schema migration, copied register/package data, name matching, automatic approval, customer-data mutation or Lens Native change.

Real server middleware enforces project membership for reading and configured write permission for changes. Each link checks both endpoints within the project, rejects soft-deleted packages, locks the requirement/package rows, serializes repeat requests, and commits the relationship with its activity record atomically. Generic linked-items controls exclude this managed relation. Requirement deletion requires prior explicit unlinking. Different revisions retain their own package IDs and statuses.

## Verified locally

- Real isolated PostgreSQL plus actual Express routes: missing requirements, same-name independent requirements, original/revision association, unmatched package, concurrent duplicate requests, replay-safe unlink, failed-audit rollback, invalid IDs, cross-project/deleted package refusal, linked-delete refusal, unauthenticated401, read-only403, cross-project403, authorized save/read.
- API and browser typechecks pass (repeat after final changes required by release gate).
- Visible Chrome on the local fixture imports the actual production component. Synthetic transport is explicitly labeled and never substituted for deployed acceptance. Link original + revision; cancel; duplicate button denial; missing-only filter; unlink; refresh/reopen persistence; denied write preserves links; failed read hides unreliable counts; retry; read-only controls; existing-record navigation callbacks; English/Spanish labels and notices tested. No captured console warning/error.
- Screenshots visually inspected in this task for desktop and390px container. Repaired cramped narrow selectors and stale-language success notice, then retested. Container testing is not a mobile-device or full-page responsive claim.
- Existing exports still cover their existing package table; a visible explanation prevents the new panel being mistaken for exported content. No report-format change is claimed.

## Remaining release truth

No C004 production smoke or publication yet. Full exact-head release gate and commit/push remain required. C001/C002 are previously completed source work; C003 is not accepted, C005 remains independent next scope. Do not count this as five new builds. The user’s publication cadence remains every ten unpublished builds maximum. No new credential or company-binding decision is inferred.
