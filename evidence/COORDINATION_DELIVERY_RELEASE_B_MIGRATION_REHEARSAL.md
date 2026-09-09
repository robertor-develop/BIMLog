# Coordination Delivery Release B — Migration Rehearsal

Date: 2026-09-09

## Result

`RESULT=PASS`

The authoritative Coordination Delivery integration was rehearsed only against a newly initialized, loopback-only PostgreSQL 18 cluster on port 55439. The existing local PostgreSQL service on port 55432, production, provider systems, GitHub and MAIN04 worktrees were not changed.

## Source identity

- Accepted MAIN04 / `origin/main` baseline: `e6532fc37ec6ca3354fac7aeb4402269cb726edb`
- Authoritative integration commit: `349d90a9650fd85a49e57d777ce7e3567a0e9569`
- Living Brief seal at rehearsal: `47698d2a94c71885d0f878964fdf8d8a1358cbf9`
- Integration branch: `codex/bimlog-coordination-release-b-integration-20260909`

## Rehearsal evidence

- Fresh target began with zero public tables.
- The integrated Drizzle schema applied without a destructive proposal and produced 205 public tables.
- Enterprise identity migration executed twice successfully.
- Connector foundation migration executed twice successfully.
- Seeded company, user, project and platform-setting sentinel records retained the same digest across both repeated migrations.
- A controlled failure was injected after connector DDL inside the real migration transaction wrapper.
- The wrapper issued rollback; the rollback sentinel table was absent and the complete table inventory was unchanged.
- Final inventory: 205 tables, 3,074 constraints, 530 indexes and 2 non-internal triggers.
- Custom-format backup: 933,156 bytes.
- Backup SHA-256: `99efb36d090a126ba14b2a7a59fd0cf3829f97551f737c298250806e5b0b0705`.
- Restore into a second disposable database matched the source: 205 tables and exactly one expected company, user, project and platform-setting sentinel.
- The temporary cluster was stopped and its verified worktree-local `.tmp` directory was removed.
- Port 55439 was closed after cleanup; the pre-existing PostgreSQL service on port 55432 continued accepting connections.

The first schema command failed before mutation because the repository Drizzle config did not resolve its Windows schema path. The successful retry supplied the same real schema file by explicit absolute path; no product source was altered to bypass the failure.

## Release decision

`SOURCE_INTEGRATION_READY=YES`

`PRODUCTION_SCHEMA_APPLICATION_READY=NO`

`PRODUCTION_DEPLOYMENT_READY=NO`

Builds 1–18 intentionally provide locally verified contracts and service boundaries. Provider adapters, application startup activation, routes, UI and production-specific data reconciliation remain later implementation gates. Pushing this source is separable from deployment; deploying it now would not truthfully deliver the completed customer workflow.

## Prepared source-push packet — not executed

1. Re-run Constitution verification for project `bimlog` and require `PASS`.
2. Require this branch to be clean and a straight descendant of `e6532fc37ec6ca3354fac7aeb4402269cb726edb`.
3. Run the complete production build, Builds 2–18 behavior suite, enterprise identity, unified action, connector foundation, project-retirement and Living Brief gates.
4. Push only the exact clean final sealed commit to `refs/heads/codex/bimlog-coordination-release-b-integration-20260909`.
5. Read back that remote ref and require exact SHA equality.
6. Do not advance `main`, publish or deploy in the source-push packet.

## Future deployment packet prerequisites

Before any production deployment packet is executable, complete and independently verify:

1. Provider-specific SharePoint, Outlook and Procore adapters behind the accepted provider-neutral contracts.
2. Runtime/startup activation of the enterprise identity and connector foundation migrations through the serialized database-startup queue.
3. Authenticated project/company-scoped routes and customer UI for the approved coordination workflows.
4. A current no-overwrite production backup and isolated restore test.
5. Read-only production schema/data compatibility preflight, including same-project relationship conflicts and the exact forward-only SQL preview.
6. Version ownership reconciliation with MAIN04 so Native `N` and Platform `P` advance independently without resetting either counter.
7. An action-time packet naming the exact source commit, database target, migration digest, deployment target/ID, health/version checks, rollback boundary and immutable fallback.

No push, merge, database application, provider activation, publication or deployment is authorized or implied by this evidence record.
