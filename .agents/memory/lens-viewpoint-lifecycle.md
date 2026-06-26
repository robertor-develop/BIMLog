---
name: Lens viewpoint lifecycle + Trade/Floor sequence authority
description: Durable design decisions behind active/superseded/voided lifecycle, active-only uniqueness, the sequence-counter authority, and write-path atomicity for lens_viewpoints.
---

# Lens viewpoint lifecycle + sequence authority

`lens_viewpoints` carry a `lifecycle_status` (active | superseded | voided) that is
deliberately DISTINCT from the workflow `status`.

**Uniqueness is active-only.** `(project_id, viewpoint_id)` and
`(project_id, navisworks_guid)` are unique only among ACTIVE rows (partial unique
indexes), because Reassign keeps the old row around (superseded) while creating a new
active row that reuses the same guid/viewpoint_id.
**Why it matters:** any dedup/upsert against these keys must repeat the active-only
predicate, or Postgres rejects it (no matching arbiter index). A plain unique
constraint here is wrong and will block Reassign.

**The counter table is the sequence source of truth — not a row count.** The
per-(project, trade, floor) running number is owned by a dedicated counter table and
assigned with one atomic increment-and-return. trade/floor are coalesced so rows with
neither still key deterministically. Only the create path consumes a number; the
dedup-skip path must not. A backfill that seeds counters from existing row counts is a
prod write — show seeds and get user confirmation, and make it idempotent so a re-run
can't clobber a counter that already advanced.

**Write paths must be all-or-nothing.** Reassign (counter increment + supersede old +
insert new + activity log) and the create path (insert + sequence assign + back-fill)
each run in ONE transaction.
**Why:** a partial write leaves durable inconsistency — a superseded row with no
replacement, or a persisted viewpoint with a null sequence that the retry path (which
returns the existing row) never repairs. Guard the Reassign supersede on
`lifecycle_status='active'` and abort (409) when nothing was updated, so a concurrent
double-submit can't supersede twice.

**Auth:** every lifecycle mutation (edit/reassign/void) is a write — gate with the
project write permission, never membership-only. Hiding UI buttons is not enough.
