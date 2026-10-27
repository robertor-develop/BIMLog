# I005 — fresh session authority and discoverable project entry

The API reloads current user/company/administrator identity on each authenticated request. Stale JWT company or administrator fields do not confer authority. Retired-company and deleted-user sessions fail closed; non-session scoped tokens are refused; project membership must be active.

Actual HTTP plus isolated PostgreSQL tests pass for stale company35/token-superadmin versus current company31/non-admin, authorized project99, absent project100 membership, inactive membership, OAuth scope and retired-company denial. API type checking passes. I003 typing corrections retain its guarded transaction behavior.

The pre-existing C003 Dashboard change is preserved and integrated: English/Spanish explicit Open project actions and a separate retirement control. Chrome followed the actual component's English action to project57/analytics, inspected its Spanish action and found no warning/error console entries. This synthetic local harness is NOT Rubén's authenticated production acceptance.

The 2026-10-27 production correction appended company31 version2 bindings for the exact nine stale projects and retired company35 into31. Version1 history remains present, company38 remains unchanged, memberships/roles remain intact, and no company is hard-deleted. The deployed runtime is healthy on source `72fad3fcdfec44b5adead9d027906d3bd7675050`, release `v1.05.N18-P37`, with schema identity `schema-cc8c4bb93ef7f2f5b713649d`.

The visible Chrome profile has only the saved `roberto@bimcorpinc.com` credential, which authenticates as the low-privilege synthetic `Roberto Test 1` account with zero projects. It does not expose Rubén or Lorena credentials. No password reset, token fabrication, impersonation or authorization bypass was attempted. Therefore actual Rubén/Lorena refresh/reopen/clean-reentry acceptance remains externally credential-blocked even though the production authority rows are now correct.

Source gates, production build and normal push passed at `1110d27cad21323bc918f4e559757d1478e90090`. The deployed runtime already contains the reconciliation implementation; the current source-only correction is test/evidence and does not require a replacement publication at this first five-build boundary. Secure token invitation acceptance remains I006–I010 scope.
