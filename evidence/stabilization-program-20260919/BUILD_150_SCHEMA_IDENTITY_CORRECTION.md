# Build 150 schema identity correction

Date: 2026-09-20

The first read-only Replit publication receipt stopped before Publish because five workflow-governance CHECK constraints had identical predicates but different source and database identifiers. Both development and production used the established `*_check` names while source declared `*_chk` names.

The corrective source change renames only those five Drizzle constraint identifiers to the exact names already present in both databases. It changes no table, column, index, predicate, row, customer data, runtime permission, workflow behavior, or provider configuration.

Acceptance requires:

- database source-safety and schema-receipt tests;
- the complete clean pre-push gate;
- normal push of the corrective head;
- exact Replit Shell synchronization;
- a repeated publication receipt proving development and production exact with `schemaAction=NONE` and `developmentDataCopy=OFF_REQUIRED`;
- one publication and authenticated visible-Chrome acceptance.
