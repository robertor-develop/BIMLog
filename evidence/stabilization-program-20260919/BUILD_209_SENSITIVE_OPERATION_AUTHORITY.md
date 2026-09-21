# Build 209 — Sensitive-operation authority

- Upload requires authenticated project write permission and project-bound object lookup.
- Current-view export requires authenticated project membership.
- AI control-plane routes authenticate before actor resolution, deny cross-company authority, and reserve system authority for Super Administrators.
- Lens Next plugin push/pull operations authenticate and enforce project write/read authority.

Result: `PASS`; no credential, provider, database, schema, Native, or installer mutation occurred.
