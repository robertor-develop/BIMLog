# Build 202 initial-route dependency split

Date: 2026-09-21

- The authenticated feedback workspace is no longer part of the public initial browser entry.
- Anonymous routes never request the feedback chunk.
- Authenticated routes defer it for 400 ms so navigation and project context render first.
- Timer cleanup prevents a stale deferred mount after logout or component teardown.
- Deployment-module recovery remains active for the deferred chunk.

No database/schema, customer data, Native source, installer, package, Autodesk load path, or Navisworks license changed.
