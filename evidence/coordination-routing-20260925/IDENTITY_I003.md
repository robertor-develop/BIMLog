# I003 — append-only company reconciliation candidate

The bounded reconciliation operation defaults to a rollback-only dry run. It rechecks super-admin authority, exact expected binding IDs/versions, target lifecycle, absence of source users/remaining operational company references and unplanned projects. It serializes binding changes, appends replacement versions and retains original business/audit identities. Alias retirement has an attributable existing admin-log event. A replay makes no duplicate version/event.

Actual isolated PostgreSQL tests passed: ordinary-user denial, stale expected binding refusal, dry-run rollback, append-only success, repeat/no duplicates, original version preservation and unaffected project/company. Test records are connection-local temporary tables.

Production correction remains unapplied pending exact before-manifest/backup, additive schema release and the nine-binding manifest. Company38 is not inferred to be31. No customer data, templates, roles or Lens binaries changed. This is implementation/test evidence, not a claim that the live nine-project defect is repaired.
