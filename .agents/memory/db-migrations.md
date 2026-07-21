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

## Publish pipeline diffs dev helium DB vs prod — sync helium or publish DROPS prod tables
Replit's publish flow compares the **dev helium database** (DATABASE_URL) against the production database and auto-generates migrations to make prod match dev. Tables created only at runtime by the app.ts startup block exist on Neon but NOT in helium, so the publish preview generates `DROP TABLE ... CASCADE` for them — and clicking "Approve and publish" wipes real prod data (this repeatedly deleted lens_viewpoints, sequence counters, and platform_settings including Living Brief doc overrides).

**Why:** app.ts runtime migrations target the runtime DB (Neon); helium only gets what `drizzle-kit push` writes, so it drifts.

**How to apply:** after ANY schema change (new table/column), also run `pnpm --filter @workspace/db run push-force` to sync helium. Before every publish, if the migration preview shows any DROP warnings, CANCEL — never approve a publish with destructive statements.

## Indexes drift too — define them in the drizzle schema, not only app.ts
The publish diff also proposes `DROP INDEX` for any prod index missing from helium. Indexes created only via `CREATE INDEX IF NOT EXISTS` in the app.ts startup block (e.g. ai_usage_events/feedback_items) never reach helium via push-force because drizzle doesn't know about them. Every prod index must ALSO be declared in `lib/db/src/schema/*.ts` (use `index("exact_prod_name").on(...)`, with `.desc()` where prod uses DESC), then push-force. Verify parity with a full dev-vs-prod diff of tables/columns/indexes before publish — the destructive set must be empty in BOTH directions.

## Stale db types after a schema edit
`@workspace/db` is consumed by api-server via TS **project references** (composite, `emitDeclarationOnly`, outDir `lib/db/dist`). `tsc --noEmit` in api-server reads db's *built* `.d.ts`, NOT the source — so after editing `lib/db/src/schema/*.ts` you get phantom `Property 'X' does not exist on type` errors until you rebuild the declarations: `npx tsc -b lib/db --force`. The esbuild `pnpm build` bundles from source so it is unaffected, but rebuild the refs to get a clean typecheck.

## Prod objects created by runtime SQL must be mirrored by name in drizzle
Prod tables born from ensure*Schema runtime blocks carry Postgres-default object names (id bigserial -> bigint, UNIQUE constraints named *_key, composite *_pkey, raw CREATE INDEX names). Drizzle must declare the SAME names/shapes (unique("..._key"), primaryKey({name}), uniqueIndex().where(sql), bigserial) or publish preview proposes DROPs/renames, and a serial-vs-bigint mismatch generates invalid `ALTER COLUMN id SET DATA TYPE serial`.
**Why:** publish diff (drizzle-kit push vs prod) keys unique/PK/index objects by name; FK constraint names (_fkey vs _fk) are the known tolerated exception (prod kept _fkey through many publishes).
**How to apply:** when reconciling drift, snapshot pg_indexes + pg_constraint from both DBs and match names exactly; fix dev additively (ADD CONSTRAINT/CREATE INDEX), let db-dev-sync push-force clean dev-only leftovers. drizzle .desc() emits DESC NULLS LAST while raw SQL DESC is NULLS FIRST — for byte parity use `.desc().nullsFirst()` in the drizzle index def — it emits plain DESC semantics matching raw SQL, and survives push-force resyncs (manual recreates get reverted).

## CHECK constraint textual parity limit
Postgres normalizes/flattens parentheses in CHECK expressions at parse time, so byte-exact `pg_get_constraintdef` parity with an old prod constraint may be impossible (e.g. financial_journal_explanation_chk). Compare constraints semantically; a paren-only delta is not drift. FK name-only diffs (drizzle `_fk` vs prod `_fkey`) are historically tolerated by publish.
