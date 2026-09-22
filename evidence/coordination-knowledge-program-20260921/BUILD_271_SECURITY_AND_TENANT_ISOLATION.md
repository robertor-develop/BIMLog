# Build 271 — Security and tenant-isolation audit

Status: `PASS_SOURCE_CANDIDATE`

The executable Build 271 matrix covers company and project isolation, project-role boundaries,
Company PMO separation from Super Administrator, self-escalation denial, approval authority,
draft visibility, attachment custody, retired-record selection and the complete authenticated
Coordination Knowledge endpoint surface.

- Company identity is resolved from the authenticated user and company grant; request bodies,
  query strings and route parameters cannot supply company authority.
- Project access is resolved through active membership and the canonical project/company binding.
- Company PMO receives governed company knowledge capabilities but remains `isSuperAdmin=false`.
- Project members cannot see drafts, approve, retire, administer taxonomy or promote knowledge.
- Read-only members cannot classify, select methods, record outcomes or propose lessons.
- Canonical issue, evidence-file and project scope are rechecked by the repository.
- Drafts never enter approved project guidance; retired records cannot be newly selected.

This is source and executable local verification. It is not a production authorization claim and
does not replace the Build 275 authenticated live role-boundary smoke.
