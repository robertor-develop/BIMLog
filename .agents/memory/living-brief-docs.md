---
name: Living Brief docs system
description: ESM runtime constraint + the multi-place sync needed to add a Living Brief tab
---

## Module dir resolution must support BOTH runtimes (dev tsx/ESM AND prod esbuild/CJS)
The api-server has two runtimes with OPPOSITE globals:
- dev = tsx/ESM: `__dirname` is undefined (throws), `import.meta.url` is defined.
- prod = esbuild CJS bundle (dist/index.cjs): `__dirname` is defined, but `import.meta.url` is left as `undefined` by esbuild (it does NOT shim it). So `fileURLToPath(import.meta.url)` throws `ERR_INVALID_ARG_TYPE` at runtime in prod.

Using EITHER alone breaks the other runtime, and both compile/build fine — the failure only shows at runtime, per-runtime. routes/living_brief.ts `resolveModuleDir()` prefers `__dirname` when `typeof __dirname !== "undefined"` (CJS), else `import.meta?.url` guarded before `fileURLToPath` (ESM), each in try/catch, returning null so callers fall back to `process.cwd()` walking.
**Why:** `__dirname` alone → 500 in dev; `import.meta.url` alone → 500 in prod (took down the live /api healthcheck). `typeof`/optional-chaining guards are safe in both module formats (no ReferenceError).
**How to apply:** for any path-from-module-location in api-server, use the dual-guarded helper. NEVER trust a build that only succeeded — verify the actual prod CJS bundle at runtime (`node dist/index.cjs`), not just the dev tsx server.

## Adding a Living Brief tab/doc requires syncing several places
A doc only appears (and only becomes editable) when ALL of these agree:
1. Seed file on disk at `living-brief/<NAME>.md` (created BEFORE the DOCS change, or GET /docs throws on the missing file via fs.statSync).
2. `DOCS` array in routes/living_brief.ts (controls order + presence; place new entries deliberately).
3. `EDITABLE_DOCS` set in routes/living_brief.ts (gates the POST save route AND whether GET /docs reads a platform_settings override vs disk seed).
4. Frontend `EDITABLE` array + the Export `wanted` list in artifacts/bimlog/src/pages/LivingBrief.tsx.

**Editable-without-DB-row is safe:** GET /docs falls back to the disk seed when no `living_brief_doc:<NAME>` override row exists, so a doc can be in EDITABLE_DOCS with no platform_settings row until the first save. Editable doc content lives in platform_settings (Neon, key prefix `living_brief_doc:`); PLATFORM/STATUS/AUDIT always read disk.

## Gate password: super-admin reset must stay reachable from the LOCKED screen
The Living Brief gate password (`living_brief_password_hash` in platform_settings, bcryptjs `$2b$`) is verified by POST /living-brief/unlock. The reset route POST /living-brief/password is super-admin-only (isSuperAdminMiddleware) and deliberately does NOT require the brief unlock token. The frontend MUST therefore expose the reset control on the `!unlocked` gate screen for super-admins (isSuperAdmin comes from /eligibility on mount, before unlock).
**Why:** if reset lives only inside the post-unlock admin panel, a super-admin who forgets/mistypes the password is permanently locked out — a catch-22 (must unlock to reset, can't unlock). Reported as "password not working" (it was a 401, not a bug).
**How to apply:** never move the gate-password reset back behind the unlock gate. A super-admin's authenticated prod session writing via /password also sidesteps any dev-vs-prod DB/secret uncertainty.
