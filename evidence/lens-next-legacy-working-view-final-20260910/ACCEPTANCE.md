# Lens Next legacy Open Working View compatibility evidence

Date: 2026-09-10
Baseline: `6739e8fb30c756fc7c215dd1de464ea2e3002213`
Implementation commit: `7e3c30b9`
Branch: `codex/bimlog-legacy-working-view-final-20260910`
Platform candidate: `v1.05.N17-P13`

## Field reproduction and root cause

Ruben's supplied failure report records installed Native file version `1.5.17.12` and no Native crash or relevant application error. Live read-only API inspection confirmed new records return valid `lens-next-navigation.v1` packages while the reported historical action fails with Platform `navigation_identity_mismatch`.

The exact failing production row was not accessible from Roberto's current authenticated project inventory, so its private field values were not fabricated. Source reproduction uses the same route failure with a digest-valid historical navigation package whose ServerId/ViewpointId/lifecycle/revision describe a predecessor while the selected authoritative row is the current chain tip.

Root cause: the P12 fallback accepted only a historical ServerId mismatch. It still required exact ViewpointId, LifecycleStatus, and RevisionNumber and therefore rejected otherwise attributable historical packages after legacy identity/revision evolution.

## Compatibility boundary

- Exact current validation runs first and is unchanged.
- Original supplied, embedded, and recomputed navigation digests must match.
- Project and active Navisworks model fingerprint must match exactly.
- The captured ServerId must be the selected authoritative row or resolve through existing `supersedes_id` records to the same unambiguous, non-cyclic root.
- Only the response copy's ServerId, ViewpointId, LifecycleStatus, and RevisionNumber are normalized and re-digested.
- No database write occurs on the GET route.

## Verification

- Focused navigation/identity behavior: PASS.
- Historical predecessor to current lineage: PASS.
- New/current exact identity: PASS.
- Cross-project rejection: PASS.
- Active-model mismatch rejection: PASS.
- Digest/camera tamper rejection: PASS.
- Unrelated and cyclic lineage rejection: PASS.
- Lens Next Build 10 suite: PASS.
- Lens Next Build 30 combined release journey: PASS.
- RFI/Submittal linking: PASS.
- Reference attachments: PASS.
- API and frontend typecheck: PASS.
- Help/version contract: PASS.

Publication and Ruben field verification were not authorized in this task and remain pending.
