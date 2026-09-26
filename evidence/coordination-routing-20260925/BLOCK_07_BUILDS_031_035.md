# Core operating chain — Builds 31–35

Baseline: published `152cbe34f6553c50f4be30ad1fceccccc845cde2`. Lens Next remains frozen.

1. Build 31 `bf499e64`: classify replacement phase/transition/reopen, task/role, APU source and allocation changes; allowed/forbidden/unchanged behavior.
2. Build 32 `47e03fbf`: scoped prior-release query (including superseded/retired), fingerprint verification and approval enforcement under the existing company policy lock.
3. Build 33 `6f849702`: repeat the current-policy check during publication before superseding the old release.
4. Build 34 `78e9abdc`: actionable English/Spanish error guidance for each denied change category.
5. Build 35: isolated real PostgreSQL/HTTP regression for forbidden approval and a policy tightened after approval; verify candidate remains approved, old version remains published and no successful publication audit event is fabricated. Bind helper coverage into the existing intake-authority suite.

Focused tests and API typecheck pass. HTTP proof uses a newly initialized disposable loopback PostgreSQL cluster at `F:/BIMLog/TestProof/core31-35-pg-20260926`, port 55449, and the existing bounded `delivery_template_test` runner. Its disposable test database is removed by the runner after testing; no production or historical customer records are touched.

Full exact-head release gate and push are required before this block is handed off as pushed. Publication is due at Build 40, not this five-build boundary. Live guidance and workflow acceptance remain pending that publication.

These five builds close only replacement change restrictions. Role matrices, approval hierarchies, thresholds and complete runtime enforcement remain open. SharePoint acceptance is independently incomplete (Chrome file permission and missing verified tenant destination); it is not converted into PASS. No Native, installer, schema or provider change.
