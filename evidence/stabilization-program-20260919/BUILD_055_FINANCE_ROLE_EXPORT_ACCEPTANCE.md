# Build 055 — Controlled finance role and export acceptance

- Financial Viewer can read; an ordinary scoped user without an explicit grant is denied.
- Independent Cost Approver plus an effective matching policy can approve; maker-as-checker remains denied.
- The controlled `$480,000` revision exports exact quantity, unit price, total, actor identities, state, and fingerprint.
- Builds 051–055 are covered by one aggregate deterministic acceptance command.
- Block result: PASS pending complete repository gate and push.
- Publication: not due until Build 060.
- Native/installer impact: none; focused Navisworks smoke is not required.
