---
name: Lens viewpoint lifecycle + Trade/Floor sequence authority
description: How active/superseded/voided lifecycle, partial unique indexes, the atomic sequence counter, and Reassign atomicity fit together for lens_viewpoints.
---

# Lens viewpoint lifecycle + sequence authority

`lens_viewpoints` carry a `lifecycle_status` (active | superseded | voided) that is
DISTINCT from the workflow `status`. Uniqueness of `(project_id, viewpoint_id)` and
`(project_id, navisworks_guid)` is enforced by **partial unique indexes scoped
`WHERE lifecycle_status='active'`** — superseded/voided rows are intentionally
allowed to share the same guid/viewpoint_id as the live row.

**Why partial:** Reassign creates a NEW active row that reuses the old row's guid and
viewpoint_id. A plain unique constraint would block it. The dedup path
(`onConflictDoNothing`) MUST carry the same `where: sql\`lifecycle_status = 'active'\``
predicate or Postgres throws 42P10 (no matching arbiter index).

**Sequence authority:** `lens_viewpoint_sequence_counters (project_id, trade, floor
UNIQUE, current_seq)` is the source of truth for the per-Trade+Floor running number,
NOT a count of rows. Assign with one atomic round-trip:
`INSERT ... VALUES(...,1) ON CONFLICT (project_id,trade,floor) DO UPDATE SET
current_seq = current_seq + 1 RETURNING current_seq`. trade/floor are coalesced to
`''` so rows with no trade/floor still key deterministically. Only the newly-INSERTED
viewpoint path consumes a number — the dedup-skip path must NOT.

**How to apply (Reassign):** supersede the old row FIRST (frees the partial-unique
slot), then insert the new active row. ALL of {counter increment, supersede UPDATE,
new-row INSERT, activity_log INSERT} must run in ONE `db.transaction` so a
mid-sequence failure can't leave a superseded row with no replacement or burn a
number. Guard the supersede UPDATE with `... AND lifecycle_status='active'` and abort
(409) when `rowCount===0` so a concurrent double-submit can't supersede twice. Edit
and Void are also wrapped in transactions (row update + activity_log together).

**Backfill:** seed each existing `(project, COALESCE(trade,''), COALESCE(floor,''))`
counter to its current row count via `INSERT ... SELECT ... GROUP BY ... ON CONFLICT
DO NOTHING` so a re-run can't clobber a counter that already advanced. This is a prod
write — show the computed seeds and get user confirmation before running it.
