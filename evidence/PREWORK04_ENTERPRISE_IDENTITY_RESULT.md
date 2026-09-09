# PREWORK 04 — Enterprise identity

RESULT=PASS

COMPANY_AUTHORITY=Existing `companies` table remains the one canonical enterprise identity; no duplicate company/client table was created.

CLIENT_AUTHORITY=`client` is an explicit governed project-company relationship, allowing one company to serve different roles on different projects without duplicating its identity.

CONTACT_AUTHORITY=Normalized enterprise contacts belong to one canonical company and are bound to a project through that project's exact company relationship. Optional user linkage does not make every contact a platform user.

TRADE_AUTHORITY=Normalized trade codes are reusable; project/company/trade bindings are unique and mechanically tied to the same project-company relationship.

CONTRACT_PARTY_AUTHORITY=Contract parties bind an existing financial contract to an exact project-company relationship and enforce the contract's project mechanically.

SAME_PROJECT_ENFORCEMENT=Forward-only composite foreign keys protect file parents/supersession, RFI parents/revisions and Submittal parents. Constraints are created `NOT VALID` so legacy rows remain untouched while all new or changed relationships are enforced immediately.

SCHEMA_CHANGE_REQUIRED=YES — explicit transactional migration prepared and locally verified; not connected to startup, not applied to any database.

VALIDATION=

- focused migration behavior PASS
- complete workspace typecheck PASS
- migration rollback behavior PASS
- destructive SQL scan PASS

NON_EFFECTS=No live database, production, deployment, publication, Intake/APU data or Lens Next code changed.
