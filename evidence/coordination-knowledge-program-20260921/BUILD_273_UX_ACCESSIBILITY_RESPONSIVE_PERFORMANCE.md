# Build 273 — UX, accessibility, responsive behavior and performance

Status: `PASS_SOURCE_CANDIDATE`

Build 273 repairs the nested Lessons Learned tab interface so it follows the same keyboard and
ARIA contract as the primary library tabs. Arrow Left/Right, Home and End now move both selection
and focus; the active tab alone participates in the normal tab order; each tab controls the named
panel and the panel identifies its active label.

The executable audit also verifies:

- loading, empty, error and retry states use appropriate status or alert semantics;
- catalog requests cancel when the user leaves the view, preventing stale updates;
- desktop, tablet and mobile layouts retain bounded grids and horizontal overflow where needed;
- visible keyboard focus and reduced-motion behavior are present;
- governed authoring remains a labelled modal surface with unsaved-change protection; and
- the Lens Next panel retains collapsed/expanded semantics and explicit status/error feedback.

This is source and executable local verification. Final rendered production behavior is reserved
for the authenticated Build 275 Chrome acceptance smoke.
