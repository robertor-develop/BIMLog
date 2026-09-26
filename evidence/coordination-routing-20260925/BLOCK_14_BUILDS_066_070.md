# Resource Planning block14 — Builds66–70

Baseline: 1d8652c659f2553d482127347259c7cf2b076d11, published08c2a3cb. Lens Next frozen.

- 66 / 8dc41207: expose saved version assignment identity, proposed person, dates, advisory hours, reason and warnings during review.
- 67 / 43646c36: edits invalidate evaluation/export and a delayed response cannot restore stale results.
- 68 / d9c13d56: add selects the next eligible unselected task; duplicate selection is refused with visible guidance; exhaustion is explicit.
- 69 / b79e840f: switching language does not reload/overwrite profile drafts; previous-language transient notices clear.
- 70: connected test coverage, late-language notice guard, baseline and release reconciliation.

Local Chrome imported the real ResourceSchedulingPanel from source through F:/BIMLog/TestProof/resource70-harness.tsx. Synthetic fetch responses are confined to the external local harness; no production mocking was added. Verified: two distinct additions, exhaustion notice, duplicate rejection retaining the previous choice, evaluation removal on edit, rejection of delayed stale result, and retention of 32 unsaved weekly hours and edited assignment hours after English-to-Spanish switch with workspace read count remaining one.

Static production-component English/Spanish rendering verifies saved review evidence and permission-limited states. API behavior and both TypeScript checks are required. Exact-head gate/push remains pending at authoring. Publication due after75, not70, because combined prior repair/resource publication occurred at65. Full-site/multi-role and SharePoint live acceptance remain open. No earnings, payment, approved-hours, permission or schema change.
