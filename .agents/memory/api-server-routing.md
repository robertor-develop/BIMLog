---
name: api-server router mount prefix
description: Why res.redirect in api-server route files must include the /api/v1 prefix
---

# api-server redirects must include the mount prefix

The api-server mounts its top-level router at `/api/v1` (in `src/app.ts` via `app.use("/api/v1", router)`). Individual route files use **relative** paths (e.g. `router.get("/autodesk/login", ...)`).

**Rule:** Any `res.redirect("/...")` inside a route file is resolved against the domain root, NOT the router mount point. A redirect to another endpoint in the same router must include the full prefix, e.g. `res.redirect("/api/v1/autodesk/login")`, not `res.redirect("/autodesk/login")`.

**Why:** A path-absolute redirect like `/autodesk/login` 404s because the endpoint actually lives at `/api/v1/autodesk/login`. This silently breaks redirect/recovery flows (e.g. OAuth re-auth when no session token).

**How to apply:** When adding redirects between api-server endpoints, prefix with `/api/v1`. Frontend redirects (e.g. `/dashboard`) are served by the bimlog frontend on the same production domain and stay un-prefixed.
