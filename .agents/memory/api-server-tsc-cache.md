---
name: api-server tsc stale cache
description: Why tsc in api-server reports false "missing export/column" errors and how to get a true result
---
`artifacts/api-server` uses TS project references to `lib/db`. A stale `lib/db/tsconfig.tsbuildinfo` makes `tsc --noEmit` resolve an OUTDATED view of `@workspace/db/schema` — it reports newly added tables/columns (e.g. a new table export, or clashes.fingerprint/lastPluginSyncAt/deletedAt) as nonexistent even though they are in the source.

**Why:** project references read cached declarations; the cache predates recent schema edits. `@workspace/db/schema` resolves to `./src/schema/index.ts` (no build step) at runtime, so esbuild + tsx see the real source.

**How to apply:** to get a truthful type check, `rm -f lib/db/tsconfig.tsbuildinfo lib/api-zod/tsconfig.tsbuildinfo lib/api-client-react/tsconfig.tsbuildinfo` then run `tsc -b` (not plain `tsc --noEmit`). Also: piping `tsc | tail` then reading `$?` captures tail's exit, not tsc's — use `${PIPESTATUS[0]}`. The actual ship gate is the esbuild `pnpm build`, which succeeds regardless; many pre-existing tsc errors live in unrelated routes (projects.ts, rfis/submittals/transmittals deletedAt).
