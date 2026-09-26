# Core block 11 — Builds 51–55

Baseline: 93db6e99fa450c0d4072371afb0fb26f9b3210d5, published deployment 7eade195.
Scope: company Governance author/reviewer continuity. Lens Next frozen.

- 51 / f32f9847: remove selection-dependent effect reload; reject stale successful load results; preserve newly created selection. Updated existing browser fixture authentication and asserted one detail fetch on selection.
- 52 / 74690aae: scoped reviewer eligibility, without creator/editor identifier disclosure. Commands still revalidate locked authority, revision and policy compatibility.
- 53 / 27d95925: bilingual independent reviewer and Finance guidance; missing or denied eligibility disables approval.
- 54 / d570a1db: saved-version inspection; historic definitions remain disabled, switching is blocked while dirty, returning to the draft restores its own definition.
- 55: seven eligibility combinations, published-only reader boundaries, revoked Finance grant denial, immutable revision/audit assertions and release-state reconciliation.

Focused evidence: 24 local installed-Chrome scenarios at 1280/390px in English/Spanish, real production component with explicitly synthetic API responses. Save/discard/refresh/reopen, historical inspection, approval denial, empty/loading/error/denied/read-only states pass. Screenshots/results: F:/BIMLog/TestProof/core-block11-build54-browser-20260926. Frontend/API typechecks pass. Disposable PostgreSQL HTTP lifecycle and revocation proof passes.

Test setup corrections: the old governance HTTP test assumed base tables from an earlier suite; it now initializes only its allowlisted disposable fixture. After adding revocation, the previous retirement-success expectation correctly failed with 403; the regression now proves that denial, creates a new synthetic grant, and proves authorized retirement. No production permissions were changed.

Exact-head full gate and push remain pending at source authoring. Publication is due at Build 60, not 55. Five unpublished builds. Remaining original estimate: 25 builds/five blocks; additional proven defects may change the estimate. Full live independent workflow acceptance and SharePoint tenant delivery remain unverified. These source tests do not implement the still-open policy hierarchy/threshold/runtime governance semantics.
