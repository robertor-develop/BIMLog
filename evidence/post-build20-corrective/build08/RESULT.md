# Corrective Build 8 — Immutable APU version history

- Generic APU continues to append versions and retrieve the newest 100 in explicit descending version order.
- Intake exposes how many saved immutable versions are available and makes clear that selecting a version binds rather than overwrites history.
- No parallel APU store, database change, or schema change was introduced.
