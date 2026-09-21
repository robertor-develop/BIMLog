# Build 207 — Server-side denial coverage

- Added application authentication to Autodesk hub and project listing endpoints.
- Added explicit project-membership middleware to pricing-template options, coordinator actions/views/exports, meeting audio transcription, and RFI Telegram notification context/watch routes.
- Preserved signed webhook callbacks and public health probes as intentional non-user endpoints.
- No database, schema, production data, Native, installer, or credential behavior changed.

Result: `PASS` — the complete endpoint matrix reports no missing authentication or project authority.
