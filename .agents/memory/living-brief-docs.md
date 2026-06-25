---
name: Living Brief docs system
description: ESM runtime constraint + the multi-place sync needed to add a Living Brief tab
---

## ESM: no __dirname in the api-server dev runtime
The api-server dev workflow runs via tsx in ESM mode, where `__dirname` is undefined and throws at runtime (the esbuild prod bundle is CJS and would have it — so this fails ONLY in dev, and only on the code path that touches it). In routes/living_brief.ts, `findLivingBriefDir()` resolves the seed folder from `path.dirname(fileURLToPath(import.meta.url))`, NOT `__dirname`.
**Why:** GET /living-brief/docs threw a 500 ("__dirname is not defined") in dev, breaking ALL brief docs loading. esbuild rewrites `import.meta.url` correctly for the CJS build, so the fix works in both runtimes.
**How to apply:** never reintroduce `__dirname`/`require` in api-server source; use `import.meta.url` + `fileURLToPath`.

## Adding a Living Brief tab/doc requires syncing several places
A doc only appears (and only becomes editable) when ALL of these agree:
1. Seed file on disk at `living-brief/<NAME>.md` (created BEFORE the DOCS change, or GET /docs throws on the missing file via fs.statSync).
2. `DOCS` array in routes/living_brief.ts (controls order + presence; place new entries deliberately).
3. `EDITABLE_DOCS` set in routes/living_brief.ts (gates the POST save route AND whether GET /docs reads a platform_settings override vs disk seed).
4. Frontend `EDITABLE` array + the Export `wanted` list in artifacts/bimlog/src/pages/LivingBrief.tsx.

**Editable-without-DB-row is safe:** GET /docs falls back to the disk seed when no `living_brief_doc:<NAME>` override row exists, so a doc can be in EDITABLE_DOCS with no platform_settings row until the first save. Editable doc content lives in platform_settings (Neon, key prefix `living_brief_doc:`); PLATFORM/STATUS/AUDIT always read disk.
