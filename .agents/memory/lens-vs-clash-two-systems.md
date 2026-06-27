---
name: Lens Viewpoints vs Plugin Clashes are two separate systems
description: Why a "void"/"refresh" on one side never shows on the other; what the Refresh button actually does
---

# Two separate ingestion systems on the clash_reports router

`lens_viewpoints` and `clashes` are distinct tables with distinct plugin paths. Confusing them causes "it worked sometimes / Refresh is broken" reports.

- **Lens Viewpoints page** (lensViewpointsTable): plugin pushes via `POST .../lens-sync` (CREATE-only — logs `CREATED` / `ALREADY EXISTS`, never voids/updates lifecycle). Platform reads via `GET .../lens-pull` (returns ALL rows, no lifecycle filter, ordered by capturedAt desc; frontend filters for display). Edit/Reassign/Void/Delete are platform-only endpoints hit by the UI's window.prompt buttons.
- **Clash sync** (clashesTable): plugin pushes via `POST .../plugin-sync`, platform pushes status back via `GET .../plugin-pull`. This path NEVER touches lensViewpointsTable.

**Consequences:**
- A "void queued on the plugin" can only affect the Navisworks clash side. lens_viewpoint voids come exclusively from the platform `/void` endpoint (verify via activity_log actionType='voided'). So a plugin void will never appear as a voided viewpoint — not a bug, wrong system.
- The Lens Viewpoints **Refresh button only re-reads the platform DB (lens-pull)** — it does NOT contact the plugin/Navisworks. New viewpoints arrive only when the plugin pushes lens-sync. If Refresh "shows nothing new", the plugin hasn't pushed, not a Refresh defect. The yellow "New viewpoints may be available" banner is rendered unconditionally (always visible), which misleads users into thinking data is pending.

**Pending-action duplicates:** the plugin can push a row whose `viewpoint_id` carries a `*-PEND###` token (e.g. `ME-PEND001`) but whose `display_id` collides with a real chain's display_id. That creates a stray row sharing display_id but with a different viewpoint_id and supersedes_id=null — not part of the supersede chain. Dedup keys on viewpoint_id, not display_id, so the collision is not caught.
