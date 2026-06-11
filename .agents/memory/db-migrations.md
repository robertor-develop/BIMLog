---
name: api-server schema migrations
description: How DB schema changes are applied across dev and prod in this project
---

# Schema migrations run at api-server startup

This project has no drizzle-kit push step in the deploy path. Schema columns are added two ways that must stay in sync:
1. Add the column to the drizzle schema in `lib/db/src/schema/*.ts` (for type-safety / `$inferSelect`).
2. Add an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to the startup IIFE block in `artifacts/api-server/src/app.ts`. This runs on every boot — dev (on restart) and prod (on deploy) — and is the only thing that actually mutates the prod DB.

**Why:** without the app.ts ALTER, the schema file compiles but the column never exists in the database, and queries fail at runtime in prod. The startup migration is the source of truth for what columns physically exist.

**How to apply:** when adding a column, do BOTH. After restart, confirm the log line `[migration] <name> ensured`. The async migration may not finish the instant the workflow reports "running" — if a column check returns 0 rows right after restart, re-check or apply the ALTER directly to the dev DB; the startup block still covers prod on deploy.
