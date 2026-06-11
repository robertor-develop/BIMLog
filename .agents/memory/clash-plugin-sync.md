---
name: Navisworks clash plugin sync round-trip
description: How BIMLog syncs clashes with the Navisworks plugin and the soft-delete/round-trip gotchas
---

# Clash plugin sync round-trip (Navisworks <-> BIMLog)

Two endpoints in `clash_reports.ts` move clash state between the Navisworks plugin and BIMLog:
- `POST /projects/:projectId/clash-reports/plugin-sync` — plugin pushes clashes; dedup by `(projectId, fingerprint)`.
- `GET /projects/:projectId/clash-reports/plugin-pull` — BIMLog pushes status changes back to Navisworks.

**Round-trip detection rule:** pull returns rows where `updatedAt > lastPluginSyncAt`. Plugin-sync sets both timestamps equal on every touched row, so a row only surfaces in pull after a *later* BIMLog edit bumps `updatedAt` (the PATCH clash route already sets `updatedAt = now`). New rows from a sync are therefore never immediately pulled back.

**Why the soft-delete revive matters:** fingerprint dedup must clear `deletedAt`/`deleteReason` on match. A soft-deleted clash whose fingerprint is re-sent must be revived, otherwise it stays filtered out everywhere (`isNull(deletedAt)` guards reads + the totalClashes count) and the plugin can never reintroduce it.

**How to apply:** any future change to sync dedup must keep matching across soft-deleted rows AND undelete them on re-sync. Keep the equal-timestamps invariant on sync, or pull detection breaks.
