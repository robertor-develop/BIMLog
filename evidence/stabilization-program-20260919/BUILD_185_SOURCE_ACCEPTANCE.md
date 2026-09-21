# Build 185 source acceptance

Date: 2026-09-21

## Scope

Builds 181–185 complete post-120 Block 37, the route and interconnection integrity block.

- Build 181 generates a deterministic inventory of 52 frontend routes, 19 canonical project tabs, 605 API operations, 231 frontend API references, and 88 route-owned database tables.
- Build 182 proves there are no cross-module duplicate API method/path owners, no sidebar tabs without screens, and no canonical project screens without navigation.
- Build 183 replaces two duplicate route identities with compatibility-preserving redirects: `/setup-guide` canonicalizes to Help, and legacy `/projects/:id/submittal-tracker` canonicalizes to Submittals tracking.
- Build 184 verifies specific-before-generic route ordering, deep-link compatibility, guard classification, and anonymous, zero-project, member, administrator, and global-super-administrator navigation contexts.
- Build 185 binds the exact generated graph and focused regression into the normal pre-push gate.

## Acceptance

- Focused Block 37 regression: `POST120_BLOCK37=PASS`.
- Frontend and workspace TypeScript build: PASS.
- Complete exact-head pre-push gate: required before push.
- The generated graph must exactly equal tracked source; stale evidence fails the normal gate.

## Boundaries

- No database/schema, customer data, Native source, installer, package, bridge protocol, provider configuration, or production state changed.
- Both retired route identities remain backward compatible through deterministic redirects; bookmarks do not break.
- Native and installers are unchanged, so focused Navisworks smoke is not retriggered.
- Build 185 is push-only. Publication and authenticated visible-Chrome smoke remain due after Build 190.

## Next block

Builds 186–190 reconcile UI action ownership and reach the next ten-build publication boundary.
