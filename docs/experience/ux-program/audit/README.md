# BIMLog experience audit and makeover proposal

Audit conducted September 28–29, 2026, America/New_York. Status: **proposal; no implementation or deployment authorized by this document**.

## Decision

Redesign the experience comprehensively while preserving the existing product, records, identities, permissions, financial controls, immutable snapshots, integrations, and Lens Next/native boundary. The observed problems are systemic: modules expose their own configuration and terminology instead of guiding people through a connected job lifecycle. A visual reskin alone will leave the principal problems intact.

Updated planning envelope following Roberto's September 28 meeting requirements: **150 microbuilds in 30 acceptance blocks**. The first 100 items are retained and corrected where the new decisions supersede them; UX101–UX150 add explicit delivery work for the meeting requirements. The count is a concrete decomposition, not an estimate of days or permission to execute. Existing I001–I010/C001–C120 completion is not reopened or extended by these proposal IDs. The original proposal is preserved in `history-100-build-proposal`.

## Read in this order

1. [Meeting decisions and requirements](MEETING-REQUIREMENTS.md): the full September 28 correction, rate investigation, open decisions and build traceability.
2. [Audit findings and evidence](AUDIT.md): 44 initial findings, reproduction paths, impact, proposed fixes, and limits, with a linked meeting addendum.
3. [Connected experience blueprint](BLUEPRINT.md): navigation, information ownership, intake, daily work, brand, sales, and preservation strategy.
4. [150-microbuild program](MICROBUILDS.md): 30 blocks, dependencies, deliverables, and acceptance gates.
5. [Coverage and acceptance matrix](COVERAGE.md): what was actually exercised and what still requires controlled transactional testing.

## September 28 decisions incorporated

Roberto's subsequent direction is also recorded: the complete site journey, guide, help and manual must become understandable and usable. **150 builds is the current plan, not a ceiling.** Context, next action, saved state, recovery and return paths are mandatory acceptance criteria. A technically working module does not close a confusing user journey. See R19/R20 in the meeting addendum and the journey/help design in BLUEPRINT.md.

- Eliminate Quick Setup. One full, resumable setup; no second pass through another setup mode.
- Multi-select/add project disciplines in place, explicit building levels, compact frequent/pinned discipline/document choices, and workflow-owned status codes.
- BIMtech defaults to shop-drawing delivery while other supported deliverables remain available.
- Discoverable company APU library across authorized projects, exact project/version/unit/rate binding, and no hard-coded staffing profile replacing a chosen APU rate.
- Intake budgets generic resource roles and hours; no employee assignment or full staffing gate. Future-floor work remains unassigned until Operations allocation.
- Named-member internal cost comes from an effective CEO-approved profile; the stated rates are $5.10/h for drafters, $6.50/h for coordinators and **$3.50/h only on hours exceeding the approved floor estimate**, as Roberto subsequently confirmed. Mixed-person allocation and baseline-version handling require explicit implementation semantics.
- One Intake-to-contract-to-EDT path, reusing items and verified version lineage; no duplicate entry and no removal of integrity checks.
- SendGrid/email readiness is available from setup and at the point of sending, with return to the unsent draft.

## What was actually done

Live Chrome walkthrough of public marketing/legal pages, Headquarters and company workspaces, every main project navigation destination, financial workspaces, document creation forms, populated file/RFI records, submittal views, Lens Next's web entry, and selected mobile/keyboard behavior. Main fixture: synthetic project 58, QA INTEGRAL 20260924 B. Populated comparison: project 26, ELARA EAST, labeled RUBENS TEST PROJECT. Source inspection corroborated selected issues.

This was a **broad site audit and non-destructive user smoke test**, not a claim that every transaction, permission, integration, browser, export, or native workflow passed. No business record was intentionally created or edited; forms were cancelled, and no messages, uploads, payments, approvals, deletions, or deployments were performed. Opening records may produce normal view events. Browser-local view preferences may change through ordinary navigation.

## Strongest evidence

- Intake opens commercial destinations without an explicit return-to-Intake path; browser Back recovered the saved intake, so lost navigation was demonstrated, not lost data.
- An activated job still says Ready to activate. Setup coverage is labeled Work progress even when operational task progress is 25%.
- Company and contact availability differs between Intake, RFI, Transmittal, and Change Order forms. RFI priorities repeat three times each.
- Opening a submittal through Command Center immediately enters edit mode. Its submitted date differs between editor and detail presentation.
- Actual task work sits several screens below setup/governance content in Operations.
- Profile and Notification Center contradict each other about available email/submittal notification settings.
- Pricing loses the selected plan on the way to Contact; Team is absent from the interest selector.
- About/Data Retention say physical files are not retained after routing, while Privacy allows retained uploads/imports.

## Continuity

Read-only source root: `F:\BIMLog\Worktrees\bimlog-template-gap-block01-20260923`.
Branch: `codex/bimlog-template-gap-block01-20260923`.
Reviewed HEAD: `c0e3781c82daa2d3db219afcbbbcae5673be734c`.
Live header: `v1.05.N18-P36`.
Canonical operating chain and instruction-authority checks passed for the current owner/session before this audit. No governance files were changed. Product implementation remains unchanged. This evidence directory and a documentation-only Living Brief open-loop entry record the revised requirements; no push or publication occurred.

Outstanding gates before any makeover release: approved bounded scope, verified preview/fixture environment, transactional browser journeys, role isolation, migration reconciliation, native compatibility checks where touched, and Roberto's user acceptance. Existing deferred Ruben/native field acceptance is not represented as completed here.
