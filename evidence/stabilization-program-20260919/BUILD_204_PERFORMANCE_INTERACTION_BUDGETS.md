# Build 204 performance and interaction budgets

Date: 2026-09-21

The standard pre-push gate now fails unless all Block 41 contracts hold:

- initial entry is at least 5% smaller than the Build 201 baseline;
- non-entry, non-spreadsheet chunks stay at or below 250 KiB;
- route-owned chunks stay at or below 225 KiB;
- total browser JavaScript stays at or below 4 MiB;
- feedback workspace and markup editor remain separate bounded dynamic chunks;
- the authenticated deferral is canceled on teardown and editor state is keyed to file identity;
- reports and convention editing remain route-tab lazy entries.

No database/schema, customer data, Native source, installer, package, Autodesk load path, or Navisworks license changed.
