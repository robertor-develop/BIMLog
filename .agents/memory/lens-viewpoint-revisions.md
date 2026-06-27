---
name: Lens viewpoint revision_number system
description: Invariants for the unified revision_number / lifecycle model on lens_viewpoints and how reports must scope revision history.
---

# Lens viewpoint revisions

`lens_viewpoints.revision_number` (NOT NULL default 1) tracks how many times a
viewpoint has been revised. It is part of the same supersede chain as
`supersedes_id` / `lifecycle_status`.

## Core invariant — Edit and Reassign never mutate in place
Both the Edit and Reassign routes do the same thing: mark the current active row
superseded, then INSERT a brand-new active row that copies all fields, sets
`revisionNumber = old + 1` and `supersedesId = old.id`. They return 409 if the
target row is not currently active.
**Why:** keeps a complete, immutable audit trail; the UI "(Rev N)" badge and the
history chain both rely on every revision being its own row.
**How to apply:** any new lifecycle mutation (e.g. a future "merge") must follow
the same supersede+insert+increment pattern, not an UPDATE of the live row.

## Report Revision History appendix must be chain-scoped
The Lens Viewpoints PDF appendix pulls edit/reassign/voided events from
`activity_log`. It MUST be scoped to the report's in-scope viewpoints plus their
superseded ancestors (build an id->supersedesId map, walk each `vps` row back,
filter `entityId IN scopeIds`). A bare `projectId + entityType` query leaks
unrelated project-wide revisions into filtered/active-only reports.
**How to apply:** the appendix is also gated to the full report only — the
executive one-pager is summary-only and must not include it.

## Report ID rendering
The report POST accepts `idFormat` ("displayId" default | "code") and
`includeNonActive` (default false = active rows only). Server `codeOf`/`idText`
mirror the frontend `viewpointCode()` helper and append " (Rev N)" when
revisionNumber > 1; keep the two in sync if the code format changes.
