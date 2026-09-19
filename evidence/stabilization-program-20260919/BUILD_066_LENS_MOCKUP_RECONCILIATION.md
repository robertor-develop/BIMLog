# Build 066 — Lens mockup reconciliation

- The September 17 mockup worktree is preserved as evidence but is 122 commits behind this program and is not merged or cherry-picked.
- Its proposed `company_directory` schema and generated Living Brief state remain excluded because the current API already exposes authorized, project-bound `companyAssignmentStatus` from actual project membership.
- Lens Next now combines the authorized member-company names and convention assignment names returned for the same exact project. Duplicate names are removed; unbound codes never become fabricated company names.
- No Native, installer, database schema, customer record, or historical revision changed.
