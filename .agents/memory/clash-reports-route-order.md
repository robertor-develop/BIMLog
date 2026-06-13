---
name: clash_reports route ordering
description: Literal sub-paths under /clash-reports must precede the :reportId param route
---
In `artifacts/api-server/src/routes/clash_reports.ts`, `GET /projects/:projectId/clash-reports/:reportId` does `Number(req.params.reportId)` with NO NaN guard and NO next() fallthrough. Any literal sub-path registered AFTER it (e.g. an existing `plugin-pull`, or a new `lens-pull`) gets captured as `:reportId`, runs the report handler, and returns 404 not_found — effectively dead.

**Why:** Express matches first-registered route; a single-segment param matches any literal segment.

**How to apply:** register literal `/clash-reports/<word>` GET routes BEFORE the `:reportId` GET (currently ~line 444). The pre-existing `plugin-pull` (registered after) is shadowed/dead — don't copy that placement. POST literals are safe vs POST `:reportId/...` only because those carry extra segments.
