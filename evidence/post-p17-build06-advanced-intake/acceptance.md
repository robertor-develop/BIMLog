# POST-P17 Build 06 — Advanced Job Intake production UI acceptance

- Date: 2026-09-11
- Production URL: `https://bimlog.app/projects/35/intake`
- Controlled project: `PRO-521-TEST` / `521 E TREMONT TEST PROJECT`
- Visible version: `v1.05.N17-P17`
- Browser: authenticated Chrome production session
- Result: PASS

## Observed production behavior

- Quick Intake loaded with the saved project identity.
- `Configuración avanzada` opened the actual production Advanced workspace.
- All seven navigation stages were visible: source documents, job identity, contractual setup, Contract Items, delivery workflow, team/resource plan, and review/activation.
- Advanced workspace exposed the expected identity, project-company/contact dependency, contract profile, bulk Contract Item editor, APU/budget bindings, delivery, staffing, readiness, save state, and activation controls.
- Existing saved identity remained present after the mode change.
- No product data was changed during this acceptance.

## Change declaration

Evidence only. No product behavior, version, database/schema, Native, deployment, or customer data changed.
