---
name: Super-admin bootstrap guard
description: Why startup migrations must not re-assert is_super_admin by email every boot
---

Startup/idempotent migrations in api-server must NOT unconditionally elevate a
hardcoded email to super admin on every boot. Guard any owner-elevation so it
only runs when the platform has zero super admins:

```
SELECT COUNT(*)::int AS n FROM users WHERE is_super_admin = true
-- only UPDATE ... is_super_admin = true WHERE email = '<owner>' when n === 0
```

**Why:** unconditional `UPDATE users SET is_super_admin=true WHERE email=...` on
each restart is identity-by-email privilege escalation (flagged in code review):
if email ownership is ever weak/spoofable, anyone holding that email regains
super admin on the next boot. A zero-super-admin guard makes it a true one-time
bootstrap that still seeds production but never re-asserts.

**How to apply:** when seeding the first admin for a new feature gate (e.g. the
Living Brief), put the guarded elevation in the app.ts migration block alongside
the table/column creation, not a bare UPDATE.
