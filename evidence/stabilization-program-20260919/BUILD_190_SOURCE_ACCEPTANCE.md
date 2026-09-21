# Build 190 source acceptance

Date: 2026-09-21

## Scope

Builds 186–190 complete post-120 Block 38, the open-loop truth reconciliation block.

- Build 186 classifies all 144 open-loop records as product work, field evidence, provider evidence, or stale contradiction.
- Build 187 closes obsolete release-checkpoint contradictions with exact commit and test evidence.
- Build 188 binds every open record to an owner and module; product work also names its owning route.
- Build 189 makes one explicit marker the sole current authority and reconciles seven repeated historical statements to canonical records.
- Build 190 binds regeneration and verification of the disposition inventory into the normal release gate.

## Acceptance

- Focused Block 38 regression: `POST120_BLOCK38=PASS`.
- Current-authority marker count: exactly one.
- Current unchecked records after live closure: exactly one, covering only Ruben's deferred Navisworks 2025 field evidence.
- Unresolved duplicate statement groups: zero.
- Complete exact-head pre-push gate: passed for source `50ee888807974b5c20772331944a1ee78442f96a` before push and publication.
- GitHub stabilization branch and `master`: exact source `50ee888807974b5c20772331944a1ee78442f96a`.
- Replit publication: `dcbe8579`, completed without Replit Agents.
- Live identity: `v1.05.N18-P36`, package `bimlog-50ee888807974b5c-6efedd640d558eb0`, health/readiness HTTP 200.
- Authenticated Chrome smoke: dashboard, project analytics, compatibility redirects, Submittals, Lens Next, Living Brief, reload, and two-tab session continuity passed with no console errors.

## Boundaries

- No database/schema, customer data, Native source, installer, package, bridge protocol, provider configuration, or production state changed by the source block.
- Historical evidence remains preserved; only its current-authority effect is removed.
- Native and installers are unchanged, so focused Navisworks smoke is not retriggered.
- Publication uses the established Replit Shell path without Replit Agents, followed by authenticated visible-Chrome smoke.

## Next block

Builds 191–195 own Lens Next post-closure field evidence, including Ruben's deferred physical Navisworks 2025 result.
