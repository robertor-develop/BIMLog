---
name: Plugin cross-system review — deferred (not-yet-built) follow-ups
description: Real but lower-urgency plugin/lens-sync gaps consciously left unbuilt; the rationale so they aren't re-discovered cold
---

# Deferred follow-ups from the plugin cross-system review

Durable contract from that review: the lens-sync collision-skip returns `id:null`
with `skipped/reason` (never the foreign row id), and Void is active-only (409
`not_active`) like Edit/Reassign. Plugin-side caveat: a strict non-nullable numeric
`id` (e.g. C# `int`) must be nullable (`int?`)/tolerant to deserialize the skip row.
The four items below are real but deliberately left unbuilt — capture for whoever
picks them up.

1. **Stuck pending-actions on a permanently-superseded id.** The plugin queues
   Edit/Reassign/Void against the serverId it holds (the old row). If the platform
   supersedes that row first, the queued retry hits a now-inactive id and gets `409
   not_active` forever — the plugin has no logic to re-pull and re-map to the new
   active head of the chain, so the action wedges. Fix direction: plugin must
   re-resolve the active head (via lens-pull / supersedes chain) before retrying.

2. **Navisworks-side optimistic-seq display divergence.** The plugin bakes the
   optimistic `{seq}` into the viewpoint name + an appended Comment, then aligns its
   counter to the server's corrected value (SeedTradeFloorSequence). But Navisworks
   names/Comments are append-only, so the Navisworks-side label keeps the optimistic
   number while the platform shows the server-corrected one whenever an "R"
   correction is issued. Cosmetic mismatch between the two surfaces.

3. **Existing-row re-sync does not return the seq.** lens-sync returns
   `tradeFloorSeq`/`tradeFloorSeqCorrection` ONLY on a freshly created row
   (`created:true`). An "already exists" (`created:false`) result omits them, so a
   plugin that lost its local counter can't recover the seq from a re-sync. The seq
   IS available via lens-pull, so the recovery path exists, just isn't wired.

4. **Read-only plugin users silently fail sync.** lens-sync requires
   `requirePermission("admin","write")`; lens-pull only needs project membership. A
   read-only member can pull but every sync 401/403s. If plugin operators aren't all
   admins/writers, syncs fail silently from their perspective.

**Why deferred:** all four are correctness/UX gaps, none are data-corruption or
recurrence risks (the built fixes already close the stray-duplicate and silent-void
holes). Left out to keep that change set tight.
