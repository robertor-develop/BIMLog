# C010 — shared runtime decisions and release checkpoint

Baseline:3bb5a0bab5aa9af2f5f6a5f63462e5a9266f0d45.

The existing Operations panel reads the server's frozen-policy progress and decision codes. It displays pending approval role/level, permits the next eligible policy approval, blocks role/economic/change-denied actions, and provides bilingual explanations. Mutation commands re-evaluate authority and revision. A stale UI cannot grant permission. Governance authoring text states precisely which categories are enforced; unconnected create/activate/template/economic-action hierarchies are not advertised as operational.

Local evidence:
- Actual PostgreSQL runtime: same decision code on read/mutation denial, eligible approval read followed by successful mutation, phase/final chain, independent review, frozen economics, audit and allowed/forbidden reopening.
- Chrome actual-component fixture: two-stage approval 0/2 to2/2, completion disabled until approvals, refresh, wrong-role disabled button, locked assignment selector, read-error removal of controls, English/Spanish,390px container. Console errors empty. Screenshot was actually inspected after tool recovery. Synthetic transport is explicitly labeled; not live acceptance.
- Eight-command exact-head local gate includes governance PostgreSQL tests plus the previous seven checks. Full exact-head run pending at authoring.

Release state: local candidate, not pushed/published. Publication due at C010. No native Lens/installer/schema changes. Real tenant SharePoint consent and identity/email operational evidence remain outside this source checkpoint. Do not mark full program or all configured policy actions complete.
