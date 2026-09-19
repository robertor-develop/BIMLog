# Build 064 — Coordination register and export parity

- A strict project-bound saved-view contract owns type, status, responsible-company, search, sort, and page-size state.
- Search, filters, stable sorting, pagination, and cross-project rejection use one deterministic result.
- PDF/CSV producers can consume the same filtered export model; the CSV proof contains exactly the filtered rows and no hidden records.
- Focused parity and API TypeScript checks pass.
