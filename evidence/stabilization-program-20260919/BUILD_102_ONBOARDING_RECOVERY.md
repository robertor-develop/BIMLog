# Build 102 — Invitation and onboarding recovery

- Registration preserves pending-invitation email binding and does not create a duplicate company for a matching invitation.
- Project-access HTTP failures no longer silently classify an invited account as a new workspace.
- A visible bilingual retry state preserves the account and retries the authoritative project lookup.
- Focused contract: `pnpm --filter @workspace/api-server run test:block21-build102`.
