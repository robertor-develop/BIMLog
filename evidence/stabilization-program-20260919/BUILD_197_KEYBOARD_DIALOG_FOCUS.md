# Build 197 — keyboard and dialog focus

Date: 2026-09-21

- Added one application-level modal focus guard for customer dialogs carrying `role="dialog"` and `aria-modal="true"`.
- Newly opened dialogs receive deterministic initial focus when a component has not already managed it.
- Tab and Shift+Tab remain within the top modal; focus returns to the invoking control after closure when it still exists.
- Existing component-managed focus remains authoritative and Escape behavior remains owned by each workflow.

