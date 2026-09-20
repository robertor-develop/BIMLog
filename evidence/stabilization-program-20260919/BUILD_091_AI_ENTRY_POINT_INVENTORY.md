# Build 091 — AI entry-point inventory

- Canonical inventory: `AI_ENTRY_POINT_INVENTORY.json`.
- Scope: every API `messages.create` provider-generation call site.
- Result: 45/45 entries identify provider acquisition, source context, cost control, output authority, and persistence classification.
- Gate: `pnpm check:ai-entry-points` rejects stale inventory, ungoverned client acquisition, direct provider construction, and unapproved direct provider endpoints.
- Silent dashboard invocation found during inventory was removed rather than grandfathered.
