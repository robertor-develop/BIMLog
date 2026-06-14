---
name: DB verification target mismatch
description: Why executeSql/checkDatabase queries come back empty for api-server data, and how to actually verify app DB changes.
---

The `executeSql` / `checkDatabase` code-execution callbacks query the workspace
`DATABASE_URL` (the local Replit-provisioned Postgres). The api-server process
connects to a DIFFERENT database (a Neon/`helium` instance configured via its own
env). So querying app tables (projects, lens_viewpoints, lens_viewpoint_reports,
etc.) through `executeSql` returns empty result sets even when the data exists.

**Why:** two separate databases — tool DB ≠ app DB.

**How to apply:** to verify api-server schema/data changes, do NOT rely on
`executeSql`. Instead check the api-server startup migration logs (e.g.
`[migration] ... ensured`) via `refresh_all_logs`/grep on `/tmp/logs/artifactsapi-server*.log`,
or hit the API endpoints directly. The startup `CREATE TABLE/INDEX IF NOT EXISTS`
block in `app.ts` is the source of truth for what the app DB actually has.
