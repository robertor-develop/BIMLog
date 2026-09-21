# Coordination Knowledge Library — Block 3 source acceptance

Date: 2026-09-21
Builds: 236–240
Status: `PASS_SOURCE_CANDIDATE`

## Scope delivered

- Build 236: protected Coordination Knowledge workspace, primary navigation entry, responsive four-section shell, and keyboard-operable tabs.
- Build 237: company-scoped Conflict Type catalog with search and discipline, element, category, status, and tag filters plus explicit loading, empty, error, revision, and status states.
- Build 238: permission-aware Coordination Rules catalog with applicability and lifecycle filters, approval identity, linked Conflict Types, references, attachments, and on-demand revision history.
- Build 239: Resolution Methods catalog with conflict, trade, discipline, RFI, approval, and status filters; related rules and prior cases; advisory semantics; and retired-method selection protection.
- Build 240: permission-aware Lessons Learned queue shell for Proposed, Under Review, Approved, Rejected, and Merged states with required source-issue/evidence framing and explicit no-automatic-approval behavior.

## Security, accessibility, and compatibility

- All catalog reads use the authenticated coordination-knowledge APIs and their server-resolved company authority.
- Draft visibility and lesson review/promotion affordances derive from server-issued capabilities; the client does not manufacture authority.
- Lessons cannot be automatically approved or promoted from this shell, and promotion remains a separate controlled company-PMO action.
- Tabs expose correct tablist/tab/tabpanel semantics and keyboard navigation; status meaning is written as text and not encoded by color alone.
- Existing BIMLog modules, canonical issue creation, Lens Native, installers, and bridge contracts remain unchanged.

## Verification completed before Build 240 commit

- Block 3 focused behavior suite — PASS.
- BIMLog application typecheck — PASS.
- API typecheck after Build 239 repository projection — PASS.
- Build 239 repository relationship projection behavior — PASS.
- Diff whitespace validation — required before commit.

## Release boundary

Build 240 is a push-only boundary. No Replit publication or authenticated Chrome smoke is due until Build 245. Navisworks smoke is not required because this block does not change Lens Next Native, the bridge, installers, or packages.
