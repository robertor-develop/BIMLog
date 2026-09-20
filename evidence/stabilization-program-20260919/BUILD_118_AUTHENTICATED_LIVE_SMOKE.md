# Build 118 — Authenticated live Chrome smoke

- Acceptance requires visible Chrome, HTTP 200 health/readiness, and exact live source identity.
- Super Administrator authentication, dashboard, project workspace, Lens Next route, reload restoration, and two-tab continuity must pass.
- Console and page errors must remain zero. A stale package, mismatched source, login failure, or broken route fails acceptance and requires correction before closure.
