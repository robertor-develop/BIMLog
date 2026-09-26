# C009 — frozen approved-work change boundaries

Baseline:dae0b1810f665e15d094484f87318111cac42a73.

Protect reopening, approved checkpoint reset, changed evidence and role assignments using the activated policy. Deny forbidden changes and in-place changes that require a new version. Allowed changes retain reapproval and append policy/revision-attributed history; no historical snapshot replacement. Current role changes clear checks and repeated unchanged role selection does not reset them.

Local PostgreSQL runtime PASS includes permitted reopening, retained audit, forbidden reopening and new-version-required denial with deep before/after equality. Existing workflow replacement validation remains unchanged. Full release and authenticated Chrome are pending. No native Lens, schema or production data changes.
