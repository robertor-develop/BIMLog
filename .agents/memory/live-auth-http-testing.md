---
name: Live authenticated HTTP testing against api-server
description: How to run real end-to-end authenticated HTTP tests against the running api-server from a spawned node script
---

# Live authenticated HTTP testing

`JWT_SECRET` is a real, persistent env secret (not the ephemeral dev-generated one), so a separately spawned node script can mint a Bearer token the running server will accept. This enables true end-to-end HTTP verification (HTTP -> authMiddleware -> route -> DB) without the user's login password.

**How to apply:**
- Mint: `jwt.sign({ userId, email, companyId, fullName, companyName }, process.env.JWT_SECRET, { expiresIn: "1h" })`. authMiddleware/requirePermission only use `userId`; the rest populate activity_log.
- Module resolution: require `jsonwebtoken` from `artifacts/api-server` (direct dep); require `pg` via absolute path `/home/runner/workspace/lib/db/node_modules/pg` (pg is NOT in api-server's node_modules, pnpm no-hoist).
- Server base URL for in-container calls: `http://localhost:8080/api/v1`.
- requirePermission("admin","write") passes for role `project_admin`.

**Browser limitation:** the screenshot tool cannot inject a JWT into the browser's localStorage, so authenticated frontend pages (anything behind login) cannot be driven via app_preview screenshots. Verify served frontend rendering by reading the Vite-served source instead.

**Why:** discovered while doing read-only verification that required live Edit/PDF tests; minting a token against the real JWT_SECRET is the only way to exercise authenticated routes end-to-end from a script.
