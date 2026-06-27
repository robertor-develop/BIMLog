---
name: createNotification is non-throwing (best-effort)
description: Why awaiting createNotification in a request handler cannot turn a committed write into a 500
---

`createNotification(...)` in `artifacts/api-server/src/routes/notifications.ts` wraps
its insert in an internal `try/catch` and swallows errors (`// non-fatal`). It never
throws.

**Why:** callers (e.g. `meeting_minutes.ts`, `transmittals.ts`, `change_orders.ts`)
`await` it inline after the primary write/commit. If it could throw, a successful
status change would surface as a 500 and invite duplicate retries. Because it
swallows, a notification failure is silent and harmless to the parent request.

**How to apply:** do NOT wrap `createNotification` call sites in extra try/catch to
"protect" the handler — it is already protected. A code reviewer that flags this as a
false-failure risk is missing the helper's internal catch (pass `notifications.ts` in
review scope). The tradeoff is intentional: notification delivery is best-effort.
