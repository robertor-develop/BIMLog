# I005 — fresh session authority and discoverable project entry

The API reloads current user/company/administrator identity on each authenticated request. Stale JWT company or administrator fields do not confer authority. Retired-company and deleted-user sessions fail closed; non-session scoped tokens are refused; project membership must be active.

Actual HTTP plus isolated PostgreSQL tests pass for stale company35/token-superadmin versus current company31/non-admin, authorized project99, absent project100 membership, inactive membership, OAuth scope and retired-company denial. API type checking passes. I003 typing corrections retain its guarded transaction behavior.

The pre-existing C003 Dashboard change is preserved and integrated: English/Spanish explicit Open project actions and a separate retirement control. Chrome followed the actual component's English action to project57/analytics, inspected its Spanish action and found no warning/error console entries. This synthetic local harness is NOT Rubén's authenticated production acceptance.

I001 production diagnostics found nine current bindings still at historical company35. The correction helper is tested but production remains unchanged. No company is hard-deleted, no company38/name-only merge is performed and no Lens Native/installer is changed.

Release checks and normal push remain required. This block plus preserved C001/C002 will be seven unpublished commits; count all seven toward the ten-build cap. The production schema must receive the reviewed additive lifecycle SQL before this code is deployed. Exact manifest/backup and live rebinding verification remain release work. Secure token invitation acceptance remains I006–I010 scope.
