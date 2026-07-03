# BIMLog by IgniteSmart

## Overview

BIMLog is a full-stack BIM project coordination and accountability platform for the AEC (architecture, engineering, construction) industry. Built with React + Vite frontend and Express 5 backend in a pnpm monorepo.

## Email Notification System (SendGrid)

- **Email service**: `artifacts/api-server/src/lib/email.ts` — 10 HTML templates (T1–T10), `sendEmail()`, `notifEnabled()`, `getUserLang()`
- **Env vars**: `SENDGRID_API_KEY`, `BIMLOG_URL` (defaults to `https://bim-log-ignite.replit.app`)
- **FROM address**: `notifications@ignitesmart.ai`
- **Background job**: `artifacts/api-server/src/lib/overdue-notifier.ts` runs hourly RFI + submittal overdue checks

### Email triggers wired in routes:
- **T1** (Invitation): `members.ts` POST /invitations → invitee email on invite creation
- **T2** (RFI Assigned): `rfis.ts` POST /rfis → `submittedToEmail` recipient on RFI creation
- **T4** (Submittal Assigned): `submittals.ts` POST /submittals → `submittedToEmail` on creation
- **T6** (Naming Violation): `files.ts` POST /files → uploader + project admins on 422 rejection
- **T7** (Procurement Before Approval): `submittals.ts` PATCH → project admins when status is on_order/delivered/installed and submittal not yet approved
- **T8** (Rapid Approval): `submittals.ts` POST /respond → project admins when approved in <60s of first open
- **T9** (Team Member Added): `members.ts` POST /members → new member email on add
- **T10** (Password Reset): `auth.ts` POST /auth/forgot-password + POST /auth/reset-password

### Password Reset Flow:
- Backend: POST /auth/forgot-password (generates token, saves with 1hr expiry, sends email) + POST /auth/reset-password (validates token, updates password)
- Frontend: "Forgot password?" link on Login.tsx → `/reset-password` route → `ResetPasswordPage.tsx` (two-stage: email request + new password form)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + wouter router + TanStack React Query
- **Backend**: Express 5 API server
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: JWT (bcryptjs + jsonwebtoken)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **i18n**: JSON-based EN/ES translation files with React context provider
- **State**: Zustand (auth store)
- **Build**: esbuild (CJS bundle for server), Vite (frontend)

## Structure

```text
├── artifacts/
│   ├── api-server/          # Express API server (port 8080, path /api)
│   │   ├── src/routes/      # Route handlers: auth, projects, files, rfis, submittals, activity, conventions, members, config
│   │   └── src/middlewares/  # JWT auth, config-validator middleware
│   └── bimlog/              # React + Vite frontend (root path /)
│       └── src/
│           ├── pages/        # Landing, Login, Register, Dashboard, ProjectDetail
│           ├── pages/project/ # FilesTab, RfisTab, SubmittalsTab, ActivityTab, TeamTab, ConventionBuilder, NameGenerator
│           ├── store/        # Zustand auth store
│           ├── lib/          # i18n (JSON files), config-context, utils
│           ├── lib/i18n/     # en.json, es.json translation files
│           └── components/   # UI components, layout (Navbar)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks (with JWT token injection)
│   ├── api-zod/             # Generated Zod schemas from OpenAPI
│   └── db/                  # Drizzle ORM schema + DB connection
│       └── src/schema/      # users, projects, files, rfis, submittals, activity, conventions
├── scripts/                 # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Key Features

- **Strict Naming Convention Validation**: Files are REJECTED server-side if name doesn't match active project convention (field count, separator, allowed values)
- **Immutable Activity Log**: Append-only log with user name, company, timestamp, action type, file name before/after. No delete endpoint.
- **Name Generator**: Dropdown-only fields sourced from active convention. No free-text input.
- **Role-Based Access**: DB-driven via config_options with permission metadata (admin/write/read). No hardcoded role names.
- **Bilingual**: Full EN/ES i18n toggle
- **RFI System v2**: Full construction RFI with 8-section form (header, submitted by/to, reference info, question, impact, distribution, AI assistant), ball-in-court tracking, PDF export, revision system, list/log view toggle, CSV export, bilingual
- **AI Question Generator**: Claude (claude-haiku-4-5) generates formal RFI questions from plain-language descriptions via `/api/v1/rfis/generate-question`
- **Submittal Register**: Full lifecycle tracking with type classification

## Admin System (Unified Two-Scope Model)

Two admin panels share the same `/admin/*` endpoints with different scopes:

- **AdminPanel** (`/admin`): Project-scoped admin. Uses `?scope=mine` on all GETs. Restricted to projects where user is `project_admin`. Create-user requires `projectId` (enforced by backend).
- **TotalControl** (`/total-control`): Super admin only. Platform-wide scope (no `?scope` param). Tabbed layout with dark header. Same 6 tabs: Overview, Users, Companies, Projects, Email Log, Activity Feed.

Both panels have identical CRUD capabilities:
- Users: Create (with project selector), Reset Password, Delete
- Companies: Edit, Delete
- Projects: Archive/Restore, Transfer Ownership, Delete

**Linkage rule**: When a project admin creates a user, `projectId` is required and a `project_members` row is always created. Super admin can optionally select a project.

**Surgical fix endpoint**: `POST /admin/fix-specific-link` (super admin only, body: `{userId, projectId}`) — creates a single explicit project_members row. No auto-detection, no loops, no inference.

**Convention assignment**: TotalControl Overview tab project detail modal includes convention company pills with assign-user flow via `POST /projects/:projectId/assign-company-user`.

**Projects list endpoint**: `GET /admin/projects-list` (lightweight id/code/name for dropdowns, supports `?scope=mine`).

## Environment Safety Lock (MANDATORY)

**Two separate databases exist. They are NOT the same.**
- **Runtime DB (dev AND prod)**: Neon via `PROD_DATABASE_URL` (shared env scope, host `ep-cold-wind-...neon.tech/neondb`). The api-server ALWAYS connects here — in the workspace dev run and in the published deployment. Verified via the deployment log line `[DB] Connecting to: ...neon.tech/neondb`. This is the only database with real data.
- **Replit built-in DB (helium)**: `DATABASE_URL` — used ONLY by drizzle-kit CLI (`pnpm --filter @workspace/db run push`). Never used at runtime. No app data lives here.

**PUBLISH SAFETY (CRITICAL — cause of repeated data loss until 2026-07-03):**
- Replit's Publish flow diffs the helium dev DB against the production DB and auto-generates migrations. If helium is missing tables/columns that exist in prod (because they were created by the app.ts startup block), Publish generates `DROP TABLE ... CASCADE` and approving it WIPES production data.
- Rule 1: after ANY schema change, run `pnpm --filter @workspace/db run push-force` to sync helium (registered as validation step `db-dev-sync`).
- Rule 2: NEVER click "Approve and publish" if the migration preview shows any "You're about to delete..." / DROP warnings. Cancel and sync helium first.

**Environment check endpoint**: `GET /api/v1/env-check` returns `{mode, dbHost, dbName, nodeEnv}`. In development: `mode=DEVELOPMENT, dbHost=helium`. In production: `mode=PRODUCTION, dbHost=<production-host>`.

**Startup banner**: API server logs `[ENV] MODE / DB_HOST / DB_NAME / NODE_ENV` on every boot. Visible in workflow console and deployment logs.

**Pre-flight checklist (MUST run before any data change)**:
1. `curl /api/v1/env-check` -- confirm mode matches intent
2. `psql $DATABASE_URL -c "SELECT current_database(), inet_server_addr()"` -- confirm DB target
3. If changing production data: use `executeSql({environment:"production"})` to verify first
4. Never assume dev cleanup affects production

**Frontend build rule (LOCKED)**:
- Production base path is `/`. Defined in `artifact.toml` as `BASE_PATH = "/"`.
- Build command: `pnpm --filter @workspace/bimlog run build` (uses env from artifact.toml).
- Manual builds: `PORT=22858 BASE_PATH=/ pnpm --filter @workspace/bimlog run build`.
- NEVER use `BASE_PATH=/bimlog` for builds. Vite config has a hard guard that blocks builds with wrong BASE_PATH.
- Post-build verification runs automatically: `scripts/verify-build.sh` checks asset paths in index.html.
- If verify fails, the build exits non-zero and no deploy artifact is produced.

**No silent fallbacks**: No secondary DB, no dev/prod switching, no auto-seeding, no in-memory DB. If `DATABASE_URL` is missing, the app crashes with a clear error.

## Database Configuration (LOCKED)

- **Connection**: Single `DATABASE_URL` env var per environment, no fallback
- **Persistence**: Guaranteed by Replit infrastructure across restarts
- **Auto-seeding**: NONE. Seed script at `scripts/src/seed.ts` is manual-only
- **Auto-migration**: api-server runs an idempotent startup block in `app.ts` (`CREATE TABLE / ALTER TABLE ... IF NOT EXISTS`) against the runtime Neon DB on every boot. No drizzle-kit push runs on startup — drizzle-kit is CLI-only against helium (see PUBLISH SAFETY above)
- **Clean state**: Full reset 2026-04-09. One super admin: user 11 (Roberto Rodriguez, robertor@rryasociados.com, company 30 RRY Asociados). Production DB has user 18 (same email/credentials).
- **System config preserved**: feature_flags (6 rows), config_options (33 rows, 8 categories)

## Database Schema

32 tables total:
- **Core**: users, companies, projects, project_members
- **Documents**: files, naming_conventions, naming_fields, naming_convention_versions
- **RFIs**: rfis, rfi_responses, rfi_ball_in_court_history, rfi_view_events
- **Submittals**: submittals, submittal_register, submittal_view_events
- **Transmittals**: transmittals, transmittal_items
- **Change Orders**: change_orders, change_order_documents
- **Meetings**: meeting_minutes, meeting_attendees, action_items
- **Project Mgmt**: project_directory, project_invitations, project_milestones
- **System**: activity_log, admin_actions_log, email_log, notifications, contact_submissions
- **Config**: config_options, feature_flags

**users columns**: id, email, password_hash, full_name, company_id, created_at, job_title, phone, avatar_url, signature_url, api_token, notification_preferences (jsonb)

**companies columns**: id, name, created_at, website, address, phone, company_logo_url

The `config_options` table stores all configurable domain values (roles, statuses, separators, priorities, submittal types) with an optional `meta` JSON column for permission metadata. It serves as the single source of truth. Values are exposed via `GET /api/v1/config` and used by both frontend and backend validation. Backend RBAC uses `requirePermission("admin", "write")` which resolves allowed roles from DB at runtime (cached 60s).

## Project Intelligence Layer

- **Shared query module**: `artifacts/api-server/src/lib/project-intelligence.ts` — exported `getProjectIntelligence(projectId, filters)` assembles structured intelligence payload from live DB
- **Route**: `GET /api/v1/projects/:projectId/intelligence-summary` — returns JSON with `project`, `currentState`, `intelligenceSummary`, `timeline`, `conventionEvolution`
- **Filters**: `from`, `to` (date range, inclusive day boundaries), `versionFrom`, `versionTo` (convention version range) — applied to both timeline and evolution
- **Frontend**: `ProjectIntelligenceView` component rendered at top of ReportsTab with three blocks: Project Intelligence Summary, Project Timeline, Convention Evolution
- **Data sources**: projects, naming_conventions, naming_convention_versions, naming_fields, files (count), activity_log, users
- **Convention evolution**: per-version deltas (disciplines/docTypes/systems/extraFields/ambiguities added/removed between adjacent versions)
- **Auth**: requireProjectMember middleware allows superadmin bypass (verified via DB isSuperAdmin flag)

## API Endpoints (v1)

All endpoints are versioned under `/api/v1/`.

- `POST /api/v1/auth/register` — Register with email, password, fullName, companyName
- `POST /api/v1/auth/login` — Login, returns JWT token
- `GET /api/v1/auth/me` — Get current user (requires auth); returns all profile fields including jobTitle, phone, avatarUrl, signatureUrl, apiToken, notificationPreferences, company object
- `PATCH /api/v1/users/me` — Update personal profile (fullName, jobTitle, phone, avatarUrl, signatureUrl, notificationPreferences)
- `PATCH /api/v1/users/me/company` — Update company info (name, website, address, phone, companyLogoUrl)
- `PATCH /api/v1/users/me/password` — Change password (requires currentPassword)
- `POST /api/v1/users/me/api-token` — Generate/regenerate personal API token
- `GET /api/v1/users/me/performance-score` — Performance metrics (naming compliance, RFI close rate, submittal approval rate)
- `GET /api/v1/config` — Get app configuration (roles, statuses, separators, priorities) from DB
- `GET/POST /api/v1/projects` — List/create projects (member-scoped)
- `GET /api/v1/projects/:id` — Project details (requires membership)
- `GET/POST /api/v1/projects/:id/files` — File list and upload (upload: write roles only)
- `PATCH/DELETE /api/v1/projects/:id/files/:fileId` — Update/delete file (write roles)
- `GET/POST /api/v1/projects/:id/rfis` — RFI list and create (create: write roles, all v2 fields)
- `PATCH /api/v1/projects/:id/rfis/:rfiId` — Update RFI including answer/responded (write roles)
- `GET /api/v1/projects/:id/rfis/:rfiId/export` — PDF export of single RFI (pdfkit)
- `POST /api/v1/projects/:id/rfis/:rfiId/revise` — Create a new revision of an RFI
- `POST /api/v1/rfis/generate-question` — AI question generation (Anthropic claude-haiku-4-5)
- `GET/POST /api/v1/projects/:id/submittals` — Submittal list and create (create: write roles)
- `PATCH /api/v1/projects/:id/submittals/:submittalId` — Update submittal (write roles)
- `GET /api/v1/projects/:id/activity` — Activity log (read-only, no delete)
- `GET /api/v1/projects/:id/conventions` — Get naming convention (any member)
- `PUT /api/v1/projects/:id/conventions` — Upsert naming convention (admin permission only)
- `GET /api/v1/projects/:id/members` — Member list (any member)
- `POST /api/v1/projects/:id/members` — Add member (admin permission only)
- `PATCH/DELETE /api/v1/projects/:id/members/:memberId` — Update/remove member (admin permission only)

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/bimlog run dev` — Start frontend dev server
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks/schemas
- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm run typecheck` — Full typecheck

## Authentication

JWT tokens are stored in localStorage under key `bimlog-auth` (Zustand persist). The custom-fetch automatically injects Bearer token into all API requests.
