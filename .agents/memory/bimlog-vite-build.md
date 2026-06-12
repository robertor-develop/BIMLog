---
name: bimlog vite build requires PORT
description: artifacts/bimlog `pnpm build` fails to load vite.config.ts unless PORT is set
---

`vite.config.ts` in artifacts/bimlog throws "PORT environment variable is required but was not provided." at config-load time, so even `pnpm build` (not just dev) fails without it.

**Why:** the config reads `process.env.PORT` eagerly for the dev server bind; the same module is evaluated during build.
**How to apply:** run production builds as `PORT=3000 pnpm build` (any value works). The dev workflow already injects PORT, so only manual CLI builds need it.
