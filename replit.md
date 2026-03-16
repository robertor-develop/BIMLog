# BIMLog by IgniteSmart

## Overview

BIMLog is a full-stack BIM project coordination and accountability platform for the AEC (architecture, engineering, construction) industry. Built with React + Vite frontend and Express 5 backend in a pnpm monorepo.

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
- **i18n**: Custom context-based EN/ES language toggle
- **State**: Zustand (auth store)
- **Build**: esbuild (CJS bundle for server), Vite (frontend)

## Structure

```text
├── artifacts/
│   ├── api-server/          # Express API server (port 8080, path /api)
│   │   ├── src/routes/      # Route handlers: auth, projects, files, rfis, submittals, activity, conventions, members
│   │   └── src/middlewares/  # JWT auth middleware
│   └── bimlog/              # React + Vite frontend (root path /)
│       └── src/
│           ├── pages/        # Landing, Login, Register, Dashboard, ProjectDetail
│           ├── pages/project/ # FilesTab, RfisTab, SubmittalsTab, ActivityTab, TeamTab, ConventionBuilder, NameGenerator
│           ├── store/        # Zustand auth store
│           ├── lib/          # i18n, utils
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
- **Role-Based Access**: project_admin, company_lead, drafter, project_manager, read_only
- **Bilingual**: Full EN/ES i18n toggle
- **RFI Tracking**: Open → In Review → Responded → Closed
- **Submittal Register**: Full lifecycle tracking with type classification

## Database Schema

Tables: companies, users, projects, project_members, files, rfis, submittals, activity_log, naming_conventions, naming_fields

## API Endpoints

- `POST /api/auth/register` — Register with email, password, fullName, companyName
- `POST /api/auth/login` — Login, returns JWT token
- `GET /api/auth/me` — Get current user (requires auth)
- `GET/POST /api/projects` — List/create projects
- `GET /api/projects/:id` — Project details
- `GET/POST /api/projects/:id/files` — File list and upload (with naming validation)
- `PATCH/DELETE /api/projects/:id/files/:fileId` — Update/delete file
- `GET/POST /api/projects/:id/rfis` — RFI list and create
- `PATCH /api/projects/:id/rfis/:rfiId` — Update RFI
- `GET/POST /api/projects/:id/submittals` — Submittal list and create
- `PATCH /api/projects/:id/submittals/:submittalId` — Update submittal
- `GET /api/projects/:id/activity` — Activity log (read-only, no delete)
- `GET/PUT /api/projects/:id/conventions` — Get/upsert naming convention
- `GET/POST /api/projects/:id/members` — Member list and add
- `PATCH/DELETE /api/projects/:id/members/:memberId` — Update/remove member

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/bimlog run dev` — Start frontend dev server
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks/schemas
- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm run typecheck` — Full typecheck

## Authentication

JWT tokens are stored in localStorage under key `bimlog-auth` (Zustand persist). The custom-fetch automatically injects Bearer token into all API requests.
