# BIMLog experience audit and makeover proposal

Audit conducted September 28–29, 2026, America/New_York. Status: **proposal; no implementation or deployment authorized by this document**.

## Decision

Redesign the experience comprehensively while preserving the existing product, records, identities, permissions, financial controls, immutable snapshots, integrations, and Lens Next/native boundary. The observed problems are systemic: modules expose their own configuration and terminology instead of guiding people through a connected job lifecycle. A visual reskin alone will leave the principal problems intact.

Recommended planning envelope: **100 microbuilds in 20 acceptance blocks**. The count is a concrete decomposition, not an estimate of days, a guarantee of scope, or permission to execute. Re-estimate after the first evidence and design block; merge or split a microbuild when implementation evidence warrants it. Existing I001–I010/C001–C120 completion is not reopened or extended by these proposal IDs.

## Read in this order

1. [Audit findings and evidence](AUDIT.md): 44 findings, reproduction paths, impact, proposed fixes, and limits.
2. [Connected experience blueprint](BLUEPRINT.md): navigation, information ownership, intake, daily work, brand, sales, and preservation strategy.
3. [100-microbuild program](MICROBUILDS.md): 20 blocks, dependencies, deliverables, and acceptance gates.
4. [Coverage and acceptance matrix](COVERAGE.md): what was actually exercised and what still requires controlled transactional testing.

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
Canonical operating chain and instruction-authority checks passed for the current owner/session before this audit. No governance files were changed. Product source was clean at audit start; only this evidence directory is authored for this request.

Outstanding gates before any makeover release: approved bounded scope, verified preview/fixture environment, transactional browser journeys, role isolation, migration reconciliation, native compatibility checks where touched, and Roberto's user acceptance. Existing deferred Ruben/native field acceptance is not represented as completed here.
