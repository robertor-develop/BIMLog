# Coordination Knowledge Library — Block 8 publication candidate

Date: 2026-09-22  
Builds: 261–265  
Boundary: push and publication due at Build 265

## Accepted scope

- Build 261: evidence-gated Lesson Learned proposal from an exact closed, classified Lens issue and immutable Resolution Record.
- Build 262: company-scoped review queue with explicit submit, return, approve, and reject transitions, optimistic status checks, attributable reviewers, rationale, and audit history.
- Build 263: separately controlled promotion of an approved proposal into a new or revised draft Conflict Type, Coordination Rule, or Resolution Method. Promotion never approves knowledge automatically.
- Build 264: same-company duplicate merging with canonical redirects, self-merge denial, terminal-state guards, rationale, and immutable audit events.
- Build 265: Lens proposal UI, live company library queue, controlled reviewer actions, refresh restoration, consolidated Block 8 regression, and release reconciliation.

## Safety boundaries

- The canonical issue remains `lens_viewpoints`; proposals retain the exact Project Case, Resolution Record, evidence, company, and project identities.
- A project experience never becomes approved organizational knowledge automatically. Review and promotion remain separate permission-controlled actions.
- Block 8 adds no schema, destructive database action, Native source, bridge protocol, camera behavior, installer, package, Autodesk load path, or Navisworks-facing change.
- Focused Navisworks smoke is not applicable. The full authenticated Chrome smoke is required after the scheduled Build 265 Replit publication.

## Verification

- `pnpm run test:coordination-knowledge-block8`: PASS.
- API TypeScript: PASS.
- BIMLog web TypeScript: PASS.
- Complete clean pre-push gate, exact push, Replit Shell publication, deployed identity, and authenticated Chrome acceptance are recorded by the terminal Build 265 execution and are not pre-claimed here.
