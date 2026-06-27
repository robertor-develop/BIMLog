---
name: lens_viewpoints display_id uniqueness
description: Why lens_viewpoints has an active-scoped display_id unique index plus a lens-sync collision guard
---

lens_viewpoints now has THREE active-scoped partial unique indexes (all WHERE lifecycle_status='active'): viewpoint_id, navisworks_guid, and display_id (the display_id one also requires display_id IS NOT NULL so NULLs stay distinct).

**Why:** lens-sync dedup keys ONLY on navisworks_guid (preferred) or viewpoint_id. A retried/mis-tagged plugin sync can carry a NEW viewpoint_id but a display_id that already belongs to a DIFFERENT active chain — that slips past dedup and opens a stray duplicate active row (the original id=24 pending-action incident). The display_id partial unique index is the DB backstop; a pre-insert guard in lens-sync skips creation when an active row with the same display_id but a different viewpoint_id exists, and the 23505 catch path converts the race into a deterministic skipped:true / reason:"display_id_collision" result instead of a 500.

**How to apply:** Adding any new active-scoped unique index here must go in BOTH lib/db/src/schema/lens-viewpoints.ts AND the app.ts startup migration block. Supersede chains (Edit/Reassign) are safe with these indexes because they supersede the old row (no longer active) before inserting the new active row sharing the same display_id/viewpoint_id, so only one active row per key ever exists. Before adding a new active-scoped unique index, verify prod has zero existing active collisions for that key or the CREATE UNIQUE INDEX will fail at startup.
