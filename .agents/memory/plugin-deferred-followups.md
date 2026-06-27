---
name: Plugin cross-system review — deferred (not-yet-built) follow-ups
description: Real but lower-urgency plugin/lens-sync gaps; which now have server support vs still need plugin work
---

# Deferred follow-ups from the plugin cross-system review

Durable contract from that review: the lens-sync collision-skip returns `id:null`
with `skipped/reason` (never the foreign row id), and Void is active-only (409
`not_active`) like Edit/Reassign. Plugin-side caveat: a strict non-nullable numeric
`id` (e.g. C# `int`) must be nullable (`int?`)/tolerant to deserialize the skip row.

Status of the four items (server side now does its half on 1/3/4; the plugin still
owns the client half):

1. **Stuck pending-actions on a permanently-superseded id.** SERVER DONE: there is
   now `GET /projects/:projectId/clash-reports/lens-viewpoints/:id/active` that walks
   `supersedes_id` FORWARD to the chain tip and returns `activeId`/`lifecycleStatus`.
   STILL NEEDS PLUGIN: the plugin must call it to re-map a queued action before
   retrying, instead of looping `409 not_active` against the old id forever.

2. **Navisworks-side optimistic-seq display divergence.** STILL PLUGIN-ONLY, no
   server fix possible. The plugin bakes the optimistic `{seq}` into the append-only
   viewpoint name/Comment; when the server issues an "R" correction the two surfaces
   diverge cosmetically. Only the plugin can rewrite/annotate its own label.

3. **Existing-row re-sync did not return the seq.** SERVER DONE: both ALREADY EXISTS
   paths in lens-sync now return `tradeFloorSeq`/`tradeFloorSeqCorrection`, so a
   plugin that lost its local counter recovers it from a re-sync (no longer forced to
   lens-pull).

4. **Read-only plugin users silently fail sync.** SERVER DONE (signal): the 403 from
   `requirePermission` now carries `code:"insufficient_permissions"` + `required`
   alongside the legacy `error` string. STILL NEEDS PLUGIN: surface that as a clear
   "you lack write permission" message instead of a silent sync failure.

**Why:** items 1/3/4 were correctness/UX gaps where the server could provide the
missing half cheaply and backward-compatibly; item 2 is inherently a plugin display
concern. None were data-corruption risks.
