# Build 196 — route accessibility and responsive matrix

Date: 2026-09-21

- Generated a deterministic inventory from the tracked route graph rather than a handwritten route list.
- Covers 59 customer surfaces across desktop `1440x900`, tablet `820x1180`, and exact mobile `390x844`: 177 route/viewport cases.
- Every surface carries light/dark, reduced-motion, route-resolution, title/main-focus, keyboard focus, dialog focus, contrast, overflow, touch-target, and layout-stability checks.
- The normal pre-push gate rejects a stale matrix or any missing direct route or project tab.

