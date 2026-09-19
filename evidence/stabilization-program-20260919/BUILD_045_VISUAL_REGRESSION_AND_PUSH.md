# Build 045 — Global-shell visual regression and block push

- Result: PASS_PENDING_PUSH
- Scope: production-component visual and interaction assurance for dashboard, administration, denied, error, desktop expanded/collapsed navigation, and exact-390 mobile dashboard/drawer states.
- Browser evidence: `evidence/global-shell-browser-assurance/` contains seven inspected Chrome screenshots, `results.json`, and a concise contact sheet.
- Corrective findings: restored mobile trigger focus; reserved mobile content space below the trigger; kept the drawer and backdrop below the fixed global header; preserved visible mobile labels even when desktop collapse is persisted.
- Automated acceptance: no horizontal overflow, exactly one `h1`, no page errors, desktop resize/collapse, mobile modal semantics, body scroll lock, Escape close, and trigger focus restoration.
- Publication: not due at Build 045. The next publication and full authenticated live Chrome smoke remain Build 050.
- Native/installer impact: none; focused Navisworks smoke is not required for this block.
