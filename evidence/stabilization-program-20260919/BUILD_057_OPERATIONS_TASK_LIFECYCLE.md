# Build 057 — Operations task lifecycle

- Tasks persist ownership, progress, start date, due date, and predecessor identities.
- Optimistic versions reject concurrent stale writes; manager-only schedule changes reject invalid dates, cross-project predecessors, duplicates, self-dependency, and cycles.
- Existing task and package authorities remain canonical. API/frontend typechecks: PASS.
