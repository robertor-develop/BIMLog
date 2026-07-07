---
name: Outbound base URL config
description: How email/notification links pick their base URL, and the two-env-var gotcha
---

Outbound links in emails/invites use a base URL from env vars, with a hardcoded
fallback to the old Replit subdomain still present in source.

TWO separate env vars control this — set BOTH or links split across domains:
- `BIMLOG_URL` — used by email.ts, members.ts (invite link), auth.ts (reset link)
- `APP_URL` — used by transmittals.ts, project_directory.ts

Both are set (shared scope) to `https://bimlog.app` (custom domain, bought through
Replit, verified). Source-level fallbacks still read the old
`https://bim-log-ignite.replit.app` if the env vars are ever removed.

**Why:** custom domain bimlog.app went live 2026-07 and email links had to follow.
**How to apply:** if outbound links show the wrong domain, check that BOTH env vars
are set; changing only one leaves transmittals/directory (or email/invite/reset) on
the other value. Env var changes take effect on api-server restart (dev) and on the
next Publish (prod). autodesk.ts REDIRECT_URI is separately hardcoded and must match
the callback URL registered in the Autodesk/APS developer console — do NOT repoint it
without updating that console too.
