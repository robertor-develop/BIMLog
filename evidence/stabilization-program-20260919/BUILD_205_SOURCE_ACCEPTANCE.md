# Build 205 source acceptance

Date: 2026-09-21

Builds 201–205 complete post-120 Block 41 source work.

- Build 201 records a deterministic 53-route production-bundle baseline from the Vite manifest.
- Build 202 removes the authenticated feedback workspace from anonymous startup and defers it behind authenticated idle time.
- Build 203 isolates the capture markup editor until it is opened and keys its state to the selected file.
- Build 204 makes entry reduction, route/chunk size, total JavaScript, lazy-boundary, timer cleanup, and stale-state contracts permanent pre-push gates.
- The optimized initial entry is 458,348 bytes, 10.34% below the 511,219-byte Build 201 baseline.
- The largest route-owned chunk is 206,589 bytes; total browser JavaScript is 3,619,435 bytes.

Build 205 is the required push boundary. It is not a publication boundary; publication and full authenticated visible-Chrome smoke remain due at Build 210. No database/schema, customer data, Native source, installer, package, Autodesk load path, or Navisworks license changed, so focused Navisworks smoke is not retriggered.
