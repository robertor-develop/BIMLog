# CLAUDE.md — How Claude Must Behave on BIMLog

This file is the operating manual for any AI development partner (Claude / Replit Agent)
working on BIMLog. Read it at the start of every session before making changes.

## Who / What
- Product: BIMLog, a construction coordination platform.
- Owner: Roberto Rodriguez, CEO of BIMCapital Partners INC / IgniteSmart.
- Primary field user: Ruben (project coordination).
- This is a multi-session build. Context is preserved through the four Living Brief
  documents in this folder: CLAUDE.md, PLATFORM.md, STATUS.md, VISION.md.

## Owner preferences (hard rules)
- NO emojis anywhere — UI, code, comments, commit messages.
- Icons: lucide-react only. No other icon sets, no emoji icons.
- NO mock data and NO silent fallbacks. If something fails, fail loudly and explicitly.
- Prefer plain-text raw output. Do not hide output in collapsed boxes.
- Be terse. Do not over-explain.

## Architecture rules
- Monorepo: pnpm workspaces. See PLATFORM.md for the full map.
- Backend API is Express; every route is mounted under the global prefix `/api/v1`.
  - res.redirect in route files MUST include the `/api/v1` prefix or it 404s.
- Schema lives in `lib/db/src/schema/*` (drizzle). Every schema change must be made in
  BOTH the drizzle schema file AND the idempotent startup migration block in
  `artifacts/api-server/src/app.ts` (ALTER TABLE / CREATE TABLE ... IF NOT EXISTS).
- Route ordering: literal sub-paths (e.g. `.../lens-pull`, `.../plugin-pull`) MUST be
  registered before parameterized catch-alls like `.../:reportId`, which have no NaN guard.
- Soft-delete DELETE routes live inside their feature route files, not a separate file.
- Frontend is React + Vite + wouter. Protected pages use the `ProtectedRoute` wrapper
  (reads token from `useAuthStore`, redirects to `/login`).
- bimlog build requires PORT to be set: `PORT=3000 pnpm build`.
- api-server builds to `dist/index.cjs` via esbuild (`pnpm build` runs `build.ts`). The
  ~3.3mb bundle-size warning is normal. Restarting the API re-runs the migration block.

## Auth model
- JWT Bearer tokens. Payload carries `isSuperAdmin`.
- `authMiddleware` verifies the token; `isSuperAdminMiddleware` re-checks `users.is_super_admin`.
- Super admin is the boolean column `users.is_super_admin` (data-driven, not a hardcoded email).
- Super admins bypass project membership checks (`requireProjectMember`).

## Living Brief specifics
- The four docs are served by `artifacts/api-server/src/routes/living_brief.ts` under
  `/api/v1/living-brief/*`, gated by a password (default seeded as a bcrypt hash) plus an
  eligibility check (super admin OR `users.can_access_living_brief`).
- Only a super admin can change the gate password or grant/revoke access.
- PLATFORM.md is AUTO-GENERATED at build time by
  `artifacts/api-server/scripts/generate-platform-md.ts` (wired into `build.ts`). Do not
  hand-edit PLATFORM.md — edit the generator instead; manual edits are overwritten on build.

## What never to do
- Never add mock/placeholder data or silent try/catch fallbacks that hide failures.
- Never use emojis or non-lucide icons.
- Never change a schema in only one of the two required places.
- Never register a parameterized route before a sibling literal route.
- Never hand-edit PLATFORM.md (it is regenerated on every build).
