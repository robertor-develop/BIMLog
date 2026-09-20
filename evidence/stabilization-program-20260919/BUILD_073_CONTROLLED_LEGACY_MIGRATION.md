# Build 073 — Controlled historical Original Lens migration

- Historical repair updates the exact existing BIMLog server identity only after project/model binding, explicit current-view confirmation, bounded reason, immutable identity validation, and cryptographic visual-package validation.
- The database write is atomic and succeeds only while both package fields remain empty. An exact replay is idempotent; a different package or a concurrent winner returns conflict and cannot overwrite the accepted package.
- The first accepted migration records `legacy_visual_state_migrated` in the existing Lens event journal.
- Missing, ambiguous, cross-project, stale-identity, malformed, digest-mismatched, and already-populated cases fail closed.
- No Saved Viewpoint or BIMLog record is deleted, renamed, or duplicated.
