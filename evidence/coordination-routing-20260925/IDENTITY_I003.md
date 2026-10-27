# I003 — append-only company reconciliation candidate

The bounded reconciliation operation defaults to a rollback-only dry run. It rechecks super-admin authority, exact expected binding IDs/versions, target lifecycle, absence of source users/remaining operational company references and unplanned projects. It serializes binding changes, appends replacement versions and retains original business/audit identities. Alias retirement has an attributable existing admin-log event. A replay makes no duplicate version/event.

Actual isolated PostgreSQL tests passed: ordinary-user denial, stale expected binding refusal, dry-run rollback, append-only success, repeat/no duplicates, original version preservation and unaffected project/company. Test records are connection-local temporary tables.

## Production application — 2026-10-27

Authenticated Replit Shell used the separate `PROD_DATABASE_URL`; the development database was explicitly rejected as evidence. A read-only before query proved company35 was not retired and the latest bindings for projects36,37,38,39,40,47,48,52,54 were still company35 version1. Company31 remained canonical; Rubén user20 and Lorena user25 remained on31; unrelated company38 remained active and unaliased.

The exact guarded plan then passed rollback-only dry run with changed project IDs `[36,37,38,39,40,47,48,52,54]`. The same reviewed plan was applied by existing global Super Administrator user18 with reason `Approved BIMTECH identity reconciliation I003 2026-10-27`.

Post-application production verification proves:

- company35 is retired into company31 and no company row was deleted;
- company38 remains unretired and unchanged;
- every affected project retains its immutable company35 version1 and has a current company31 version2 whose supersession link is present;
- Rubén and Lorena retain their active memberships and roles; no membership was added, removed or rewritten;
- no customer record, template, Lens binary or unrelated company was changed.

The production nine-project company-authority defect is repaired. Actual Rubén/Lorena credentialed Chrome acceptance remains separate from the database correction and cannot be inferred from the SQL result.
