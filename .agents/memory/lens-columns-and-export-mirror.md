---
name: Lens Viewpoints columns + export mirror
description: How the on-screen Lens table view options relate to the Excel/PDF exports, and the product decision on PDF column scope
---

# Lens Viewpoints — dedicated columns, view options, and export mirroring

Lifecycle/chain attributes (Group, Lifecycle status, Revision) each render as their
OWN toggleable table column, plus an ID-format selector and a lifecycle-scope filter
(Active only [default] / All revisions). View options persist to localStorage keyed
`bimlog.lensViewOpts.${projectId}`.

**Decision: the PDF report is a row-filtering-only mirror.**
**Why:** the user explicitly chose this over a full column mirror — the PDF keeps its
fixed register columns by design; only the ROWS (lifecycle scope + trade/floor/
report-type/status filters + ID format) follow the live on-screen view.
**How to apply:** when the report modal opens, `openReportModal` seeds the export form
from the live view (`includeNonActive = lifecycleScope !== "active"`, `idFormat =
idFormatView`, `fReportType`). Do NOT add per-column show/hide flags to the PDF table
builder unless the user reverses this decision. Excel export, by contrast, uses the
same `filtered` array as the screen, so it DOES reflect the live row scope/filters.

**Backend:** the lens-viewpoints report endpoint defaults to active-only
(`includeNonActive` false) and supports trade/floor/status/reportType/priority
filters. `reportType` is a free-form text column (no enum), filtered by exact match.

**colSpan invariant:** expand rows (group / linked items / history) must use the
computed `colCount` (= 9 base columns + visible toggle columns), never a hardcoded
number, or they desync when a column is toggled.
