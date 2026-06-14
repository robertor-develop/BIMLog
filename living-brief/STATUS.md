# STATUS.md — Current Build State

Updated manually after each feature ships. Reflects the real state of the platform.

## Last updated
- 2026-06-14

## What is working right now (June 14, 2026)
- BIMLog Lens: Save Viewpoint, Sync, Jump to Viewpoint, Delete, tab persistence, amber refresh
  banner — all working.
- BIMLog Pulse: clash hit sync working — DisplayName = BIMLog Pulse confirmed.
- All 6 modules have soft delete with DeleteConfirmModal and cascade warning.
- All modules have import (any file format), PDF export, and activity logging.
- Lens Viewpoints: 5 viewpoints synced on ELARA EAST with 1185RI-* IDs.
- Jump to Viewpoint: navigates Navisworks directly via `localhost:8765/jump?code=displayId` —
  the no-cors approach is confirmed working.
- Plugin connected: green dot on the platform.
- Scrollbar always visible (grey) on the Lens Viewpoints table.
- Tab persistence on Clash Hits vs Lens Viewpoints using localStorage.
- Living Brief F5 system — built this session: four docs in `/living-brief`, served via
  `/api/v1/living-brief/*`, password gate (default BIMAI360, stored hashed), eligibility (super
  admin or granted), F5 intercept to open the brief for eligible admins, super-admin
  password/access controls. PLATFORM.md auto-regenerates on every api-server build.

## Core platform
- Auth (JWT), projects, project members/roles, admin panel, super admin.
- Coordination modules: RFIs, submittals, transmittals, change orders, meeting minutes,
  schedule, clash reports (with Navisworks plugin sync), lens viewpoints, files/documents,
  naming conventions, directory, reports, dashboard briefing, intelligence, agents.

## What Ruben needs next
- BIMLog Mirror — bidirectional clash sync — the Clash API is ready in the plugin, not built yet.
- Spell check on the Issue Note field in the BIMLog Lens panel (RichTextBox) and on platform
  textareas (`spellCheck=true`).
- Package the plugin for Ruben — install.bat, ZIP, README with installation instructions.
- Fix Unknown/Unknown trades via ComAPI — element properties are not being read correctly.

## Active build priorities
1. Session Brief endpoint — a 300-word summary for Claude session start.
2. Full agent heartbeat architecture — the 5-layer system with new DB tables.
3. BIMLog Mirror — build it using the Navisworks Clash API.
4. Spell check — plugin RichTextBox + platform `spellCheck=true`.
5. Wire existing agents to save endpoints so they fire automatically.

## Known bugs
- Agents not wired to save endpoints — clash-agent, rfi-agent, briefing-agent exist but do not
  fire automatically on save.
- APS 3-legged OAuth paused — 2-legged confirmed insufficient for ACC hub data — needs a user
  authorization flow.
- IBQ Convention Builder session paused mid-build — needs resuming when IBQ becomes active.
- Reports module partially broken.
- Unknown/Unknown trades in some clash hits — ComAPI needed to read element properties.
- linked_items table has 0 rows — cross-linking exists but is not being populated yet.

## Founding partner context
Ruben Crespo (rubenc@bimcorpgroup.com) is BIMLog's first Founding Partner. ELARA EAST is the
live reference project driving every feature. Eventually BIMLog will scale beyond Ruben — but
every decision today is validated against his real workflow.
