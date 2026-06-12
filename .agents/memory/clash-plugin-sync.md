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

**Server-side deletes never stick:** the Navisworks model is the source of truth and the plugin re-pushes the WHOLE set on every "Push to BIMLog". Deleting clashes in the DB just makes the next sync recreate them. To remove a clash permanently it must leave the model (or be resolved); DB deletes are futile against an active pusher.

**"Clashes read" can exceed unique clashes:** plugin reported 2202 read but only 1404 unique ClashIds (project 26) — ~798 are genuine duplicate ClashIds (same clash listed across multiple clash tests / both elements). High `updated` counts on a sync are these duplicates folding onto their originals, NOT data loss. Verified: total rows == distinct fingerprints == distinct clash_id_original == 1404 (zero fingerprint collisions; the plugin's 8-char ClashId truncation does not collide in practice).

**Null/empty fingerprint = duplicate-on-every-sync footgun.** Dedup only runs when `c.fingerprint` is present (route looks up existing only `if (fingerprint)`, else always inserts). Any clash pushed with null/empty fingerprint creates a fresh row every sync. The plugin's GenerateFingerprint always returns a value (ClashId-truncated or Name+TestName hash), so this is latent, not active. Diagnostic: a clash row with `last_plugin_sync_at IS NULL` did NOT come from plugin sync (both insert and update stamp it) — it's a manual-add / AI-parse row, not a sync duplicate.

**Stable round-trip requires (user goal):** (1) never change GenerateFingerprint again — a changed algorithm orphans existing rows (old fp != new fp) and forces a full duplicate set on next push, recoverable only by clearing the project's clashes once to rebaseline; (2) don't delete server-side between syncs; (3) every pushed clash must carry a fingerprint.

**How to apply:** any future change to sync dedup must keep matching across soft-deleted rows AND undelete them on re-sync. Keep the equal-timestamps invariant on sync, or pull detection breaks.

## Status mapping (BIMLog -> Navisworks) in plugin-pull

BIMLog clash `status` values are: `open` (UI label "Active"), `follow_up`, `waiting_design`, `in_progress`, `approved`, `resolved`, `wont_fix`. There is NO `active` or `new` status in real data. The Navisworks target set is New/Active/Approved/Resolved.

Mapping rule: `resolved`->Resolved, `approved`->Approved, `new`->New, everything else (including `open`, `follow_up`, `waiting_design`, `in_progress`, `wont_fix`, null) -> **Active**.

**Why:** only resolved/approved mean "done" — those are the statuses that should make a clash stop reappearing in future Navisworks clash runs. Every still-open BIMLog state must map to Active so Navisworks keeps surfacing it. `open` is BIMLog's Active state (verified in ClashReportsTab status dropdown), so do NOT capitalize-passthrough raw statuses — that would emit "Open"/"Follow_up" which Navisworks doesn't understand.

## syncToken

plugin-sync POST response includes `syncToken: now.toISOString()` (same `now` used to stamp `lastPluginSyncAt` on every processed clash). The plugin stores it. The current pull windowing is per-row (`updatedAt > lastPluginSyncAt`), self-healing because the plugin re-sends fingerprints on each sync which re-baselines `lastPluginSyncAt`. No server-side global `lastSyncAt` query param is implemented — pull can re-return an unacked change until the next sync re-baselines that row (idempotent for the plugin).
