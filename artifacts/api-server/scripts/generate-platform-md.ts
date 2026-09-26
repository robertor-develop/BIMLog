import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repo root = artifacts/api-server/scripts → up three levels
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
  }
  return out.sort();
}

function bullets(files: string[]): string {
  return files.length ? files.map((f) => `- ${f}`).join("\n") : "- (none found)";
}

// Read all router.use(...) mounts from the routes index to show the real mount order.
function routeMounts(): string {
  const indexPath = path.join(REPO_ROOT, "artifacts/api-server/src/routes/index.ts");
  if (!fs.existsSync(indexPath)) return "- (routes/index.ts not found)";
  const src = fs.readFileSync(indexPath, "utf-8");
  const mounts = [...src.matchAll(/router\.use\((\w+)\)/g)].map((m) => m[1]);
  return mounts.length ? mounts.map((m) => `- ${m}`).join("\n") : "- (no mounts found)";
}

// Pull the wouter <Route path="..."> entries from App.tsx.
function appRoutes(): string {
  const appPath = path.join(REPO_ROOT, "artifacts/bimlog/src/App.tsx");
  if (!fs.existsSync(appPath)) return "- (App.tsx not found)";
  const src = fs.readFileSync(appPath, "utf-8");
  const paths = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  return paths.length ? paths.map((p) => `- ${p}`).join("\n") : "- (no routes found)";
}

export function generatePlatformMd(): void {
  const routeFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/routes"), ".ts");
  const pageFiles = listFiles(path.join(REPO_ROOT, "artifacts/bimlog/src/pages"), ".tsx");
  const schemaFiles = listFiles(path.join(REPO_ROOT, "lib/db/src/schema"), ".ts");
  const agentFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/agents"), ".ts");
  const libFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/lib"), ".ts");
  const middlewareFiles = listFiles(path.join(REPO_ROOT, "artifacts/api-server/src/middlewares"), ".ts");

  const catalog = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "living-brief/catalog.json"), "utf8")) as {
    documents: Array<{ file: string }>;
  };

  const content = `# PLATFORM.md

> AUTO-GENERATED at build time by artifacts/api-server/scripts/generate-platform-md.ts.
> Do not hand-edit — changes are overwritten on every api-server build. Edit the generator.

This is the structural map of the BIMLog monorepo, generated from the actual codebase.
It changes only when the code structure or curated architectural facts change.

## Living Brief authoritative catalog
${bullets(catalog.documents.map((document) => `living-brief/${document.file}`))}
- Document and catalog SHA-256 values use canonical UTF-8 text with LF line endings so Windows and Linux checkouts verify identically.

## Current release and provider contract
- Current accepted Platform release: \`v1.05.N18-P34\` / \`1.5.18.34\`; Build 040 corrective source \`4472d982c2fc7ab5fde552048f024cd7e90fab96\`; Replit publication receipt \`b8718795\`. Exact live source/package/database identity and authenticated two-tab restoration passed.
- Builds 041–050 are the due ten-build publication batch. Builds 041–045 harden the global shell; Builds 046–050 add governed catalog aliases, canonical Intake classification selection, permanent pricing/workflow/Intake lifecycle regressions, and controlled role acceptance. The only schema delta is the additive, default-empty company-catalog \`aliases\` column. No Lens Next Native source or installer changed. Publication and authenticated live acceptance are required before Build 051.
- GitHub \`master\` is the product source authority. Replit is the established BIMLog publication provider; synchronize exact reviewed source through the signed-in Replit Shell, never Replit Agents.
- Publication requires the read-only database operator to prove exact development/production schema correspondence, no destructive action, development-data copy off, and a clean exact source. Build 020 returned \`schemaAction=NONE\` and changed no production row or schema object.
- Public \`/api/v1/healthz\` is both health and application-readiness evidence because the startup bootstrap holds that route at HTTP 503 until the real application barrier completes.
- Lens Next is the sole supported Lens product. Original/Legacy Lens exists only as preserved historical migration input and must not appear as a parallel customer-facing product or installed loader.

## Critical Database Facts — Read Before Every Session
- Identity candidate I001–I005 adds nullable company retirement identity/time, guarded collision prevention and fresh request authority. Apply and verify \`lib/db/scripts/company-identity-lifecycle.sql\` before deploying consumers; no production migration or nine-project binding repair is implied by local tests. Reconciliation appends versions and preserves historical company rows. Invitation token completion remains separate I006–I010 work.
- PROD_DATABASE_URL = Neon production database. This is what the running app uses for ALL reads and writes at runtime. This is the only real database.
- DATABASE_URL = Replit Helium development database. It is used ONLY by guarded drizzle-kit development-schema synchronization and never at runtime. Its structural state can influence Replit's generated production migration at Publish.
- Database URL and secret values must not be assigned in tracked .replit or recognized configuration files. Replit Secrets/environment injection supplies runtime values; the repository gate permits variable-name references but rejects literal credential material.
- The ENV startup banner historically showed DB_HOST: helium and DB_NAME: heliumdb — this was MISLEADING. It was reading PGHOST and PGDATABASE which point to heliumdb not the actual runtime connection. This has now been fixed.
- NEVER diagnose data loss by querying heliumdb. Always query Neon via PROD_DATABASE_URL.
- NEVER trust PGHOST or PGDATABASE for runtime database diagnostics.
- lens_viewpoints data that appeared to disappear on rebuild was never on Neon — it was on heliumdb which resets. All writes now go to Neon and survive all rebuilds.
- Any future database diagnostics must confirm PROD_DATABASE_URL is the connection target before drawing any conclusions.
- Replit currently documents that development structural changes may be applied to production at Publish. No supported repository configuration is proven to disable that managed migration authority. Every Publish remains human-gated; a root build cannot stop a migration Replit may apply before the build.
- Authoritative source is the explicitly fetched remote master ref, not the older remote default main. Before Helium sync or Publish, the clean Replit workspace, local master, origin/master, and freshly read remote master must match exactly and pass the commit-bound publication-source attestation.

## Monorepo shape
- pnpm workspaces.
- artifacts/bimlog — React + Vite + wouter web app (the BIMLog UI).
- artifacts/api-server — Express API. Every route is mounted under the global prefix /api/v1.
- artifacts/mockup-sandbox — component preview server (design).
- lib/db — shared drizzle schema + pg pool.

## Backend route files (artifacts/api-server/src/routes)
${bullets(routeFiles)}

## Backend route mount order (routes/index.ts, under /api/v1)
${routeMounts()}

## Backend middlewares (artifacts/api-server/src/middlewares)
${bullets(middlewareFiles)}

## Backend libs (artifacts/api-server/src/lib)
${bullets(libFiles)}

## Agents (artifacts/api-server/src/agents)
${bullets(agentFiles)}

## Database schema files (lib/db/src/schema)
${bullets(schemaFiles)}

## Frontend pages (artifacts/bimlog/src/pages)
${bullets(pageFiles)}

## Frontend routes (artifacts/bimlog/src/App.tsx, wouter)
${appRoutes()}

## Curated interconnections and gotchas (maintained in the generator)
- All API routes are served under the /api/v1 prefix. res.redirect in route files MUST
  include /api/v1 or it 404s.
- Replit monorepo deployment promotion probes GET /api. After the synchronous durable-storage
  authority preflight succeeds, the early-bound listener returns HTTP 200 from exact /api with
  an explicit {status:"starting",ready:false} liveness body while application initialization runs.
  /api/v1/healthz and every other route remain HTTP 503 until the real application is ready;
  the ready app then owns both paths and returns HTTP 200 from its canonical handlers.
- Auth: JWT Bearer; payload carries isSuperAdmin. authMiddleware verifies; requireProjectMember
  / requirePermission gate project access (super admins bypass membership);
  isSuperAdminMiddleware re-checks users.is_super_admin.
- The Platform project route and project page must honor that Super Administrator membership
  bypass consistently; ordinary accounts still require their own active project membership.
- Cross-company Super Administrator Analytics and its PDF export require an explicit, bounded
  audit reason for project-read access; the browser must collect it and bind it to the current
  account and project rather than silently bypass the coordinator read boundary.
- Schema changes go in BOTH the drizzle schema file AND the idempotent startup migration block
  in artifacts/api-server/src/app.ts (ALTER TABLE / CREATE TABLE ... IF NOT EXISTS).
- Declarative schemas preserve established production constraint, foreign-key, unique, check, and index names
  plus ordering semantics so provider comparison cannot replace compatible objects through destructive churn.
- Direct schema force-push is disabled. The guarded development sync requires exact authoritative
  master attestation, a Replit Helium target distinct from the runtime production identity, and
  read-only table/index parity. Publish additionally requires the complete generated SQL, a
  hash-bound additive inventory, a verified restore point, and affected-table count manifests.
- Route ordering: literal sub-paths (e.g. .../lens-pull, .../plugin-pull) must be registered
  before parameterized catch-alls like .../:reportId (no NaN guard).
- Soft-delete DELETE routes live inside their feature route files (see routes/index.ts comments).
- Clash reports support a Navisworks plugin sync round-trip (fingerprint dedup; pull uses
  updatedAt > lastPluginSyncAt). Lens viewpoints use a manual refresh banner (polling removed).
- Lens Next owns only BIMLog construction project/model binding, issue workflows, viewpoint
  workflows, and their governed Navisworks 2021/2025 bridge contracts. It may consume versioned
  external handoffs, but it must refuse marketing execution, portfolio finance/allocation
  authority, legal approval authority, and Knowledge Intake routing authority. The Build 10
  acceptance gate fails on semantic cross-platform authority drift.
- Lens Next local upload and create use the \`lens-next-visual-digest.v2\` SHA-256 contract with
  exact IEEE-754 tokens for camera and appearance doubles. Cryptographically verified v1 native
  captures remain compatible across .NET/JavaScript decimal formatting, while material changes
  remain fail-closed HTTP 409 with no issue/package mutation. Server diagnostics record both
  digests and the first differing field. The existing XML export reads Navisworks Saved Viewpoints
  and does not silently substitute BIMLog web viewpoint records.
- Lens Next normal create/open navigation uses the purpose-specific \`lens-next-navigation.v1\`
  contract. The persisted navigation package contains project/model identity, camera, optional
  sectioning, and an independently stored screenshot; screenshot bytes do not affect its digest.
  Normal navigation deliberately excludes full-model visibility and appearance scans. The N06
  exact-state engine is retained only behind the explicit \`restore-exact-visual-state\` diagnostic
  action and is not part of normal issue creation or Open Working View.
- Living Brief: all documents in living-brief/catalog.json are served in authority order through
  /api/v1/living-brief/* from the verified deployed source bundle. living_brief_documents is an
  exact, metadata-bearing database mirror; it never overrides source doctrine. Controlled admin
  reconciliation requires observed mirror hashes. Eligible authenticated users receive a
  short-lived brief token without a separate gate password; only super admins administer the
  durable credential/revocation state, grant access, or reconcile a mismatched mirror.
- RFI report template settings: accepted source integration uses one project-scoped report settings
  snapshot for Standard PDF, DOCX, and Complete PDF embedded canonical pages. Settings live in
  rfi_report_settings, are added through additive startup/schema wiring, and never mutate canonical RFI
  data or Lens/Viewpoint source identity.
- Cost & Value Planner presents stored compatible allocation keys as Labor Operating Pool, Project
  Incentive Reserve, and Project Earnings. Amount and percentage inputs stay synchronized across the
  allocation tree, and saved labor/phase/administrative percentages cascade when parent values change;
  the included BIM-services sample is configurable, not a platform-hardcoded policy.
  Optional section guidance, automatic detail-line remainder/equal splits, and exact save-readiness
  explanations make the complete allocation actionable. Draft and saved plans can be exported as CSV
  or generated through the governed Print PDF flow; saved plan versions remain immutable.
- Company Delivery Workflow and Workflow Governance publication share a company-scoped advisory
  boundary. Independent approval also rechecks published-policy compatibility and policy scope;
  publication rechecks again before replacing a live version. The governed runtime freezes the
  selected policy and workflow definition by version and fingerprint. Policy threshold and
  company-role matrices remain recorded intent rather than independent execution grants. A
  Super Administrator can assign or revoke narrow project-scoped EDT Operations Director
  authority for an active same-company member with an append-only reason and history. The
  guarded EDT activation mutations are not represented as a completed six-role production journey.
- Smart Intake uses the existing project-scoped \`job_intakes.data\` draft as its only pre-activation
  authority. Preserved XLS/XLSX/XLSM/CSV sources expose bounded multi-sheet previews; the user must
  explicitly choose the sheet, header row, Contract Item Name column, and Quantity column. A
  fingerprint- and revision-bound confirmation appends deterministic-ID rows with document/hash/
  sheet/row/column provenance. Ambiguous or truncated previews fail closed, and PDF/DOCX extraction
  remains manual-review evidence that cannot silently create financial records. The default editor
  exposes only Contract Item Name and Quantity for 100-plus rows; unit, currency, APU/rate, calculated
  value, workflow, budget, and descriptive overrides remain explicit Advanced controls. Activation,
  rather than import preview, creates shared operational and entitled Commercial records.
- Job Intake workspace state and document-assistance contracts are maintained outside the routed
  page component. Browser recovery remains revision-bound: an equal-revision partial draft may be
  resumed, a stale draft is discarded, and upload/save failures preserve the latest recoverable
  state. Spreadsheet inspection and mapping remain deterministic and consume zero AI credits;
  PDF/DOCX remain manual-review evidence. Any future AI text or file operation must fail closed
  unless its funding source, estimated cost, and explicit user confirmation are all visible first.
- Submittals use separated list/query, editor/review, and presentation-scope contracts. Editor,
  attachment, and review mutations carry exact record-version identity and reject stale writes with
  HTTP 409; report/export/history operations remain explicitly project and submittal scoped.
- Build 3 multi-contract activation keeps up to 50 independent contract profiles in the same
  canonical Intake draft. Every Contract Item references one owning contract. Activation creates
  or reuses the canonical Commercial contract records, freezes the selected APU or pricing snapshot
  separately for each contract, applies project-to-contract-to-item workflow inheritance, and writes
  the connected Contract Item and budget relationships idempotently. Source documents remain
  optional, ordered draft persistence remains intact, and no duplicate Intake, contract, APU,
  workflow, or budget authority is created.
- Build 4 extends that same activation transaction with generated project-budget aggregates,
  immutable Contract Item financial/APU baselines, project cost-node Budget Accounts, and
  Project to Contract to Contract Item to Budget Account drill-down. The generated execution
  baseline and content fingerprints are immutable; replay is idempotent and conflicting
  baselines fail closed rather than creating a parallel financial authority.
- Help, Job Intake, Job Operations, Cost & Value Planner, Team Performance, and Project Controls
  use the shared governed Print PDF confirmation and authenticated PDF response. Current-view
  filters are preserved where present; otherwise PDF-only section choices are explicit. The
  completed PDF downloads directly, without blank tabs, browser print screens, or window.print.
- Navbar and Help consume the same generated release-identity module. Regression checks compare
  that generated module with the canonical release contract instead of freezing a stale release label.
- Commercial Contract Items turn an approved budget line and saved APU version into an operational
  contract scope. Quantity multiplied by the frozen APU selling price calculates the contractual value;
  the immutable item snapshot preserves the APU content, evaluation, fingerprint, BIM Submittal display,
  and Phase to Revision to Version to Task workflow selection. Contract detail, searchable PDF, and native
  XLSX exports expose the same Contract Item quantities, rates, values, APU identity, and workflow metadata.
- A Generic Cost & Value APU version's selling price is a plan total, not an Intake Contract Item
  hourly or unit rate. Selecting or auto-binding the sole currency-compatible version preserves the item rate;
  a new or imported item starts at zero until its unit rate is entered. Multiple saved versions require
  an explicit version choice. Activation calculates quantity times the independently entered unit rate.

## N07 deterministic map provenance

- The \`lens-next-navigation.v1\` entry is emitted by \`artifacts/api-server/scripts/generate-platform-md.ts\`;
  build-gate fix \`b45c5ac3ade23b7a67c26423cb96d56b4dcb85b7\` makes the generated and committed
  platform authority identical.
- Build: bimlog needs PORT set (PORT=3000 pnpm build); api-server bundles to dist/index.cjs via
  esbuild and this generator runs as a pre-build step.

## N08 historical unversioned digest boundary

- Platform persistence continues to validate every explicitly versioned v1, v2, v3, and
  lens-next-navigation.v1 package under its declared contract. A historical package that has no
  contract metadata cannot be silently reinterpreted under the current v2 canonicalizer.
- When that historical package has matching stored and embedded digests plus exact issue identity,
  but lacks the original canonical evidence needed to prove its algorithm, BIMLog returns the
  dedicated historical_digest_evidence_unavailable quarantine result. It does not mutate the row,
  weaken digest validation, or claim that a current recomputation proves the old package.
- The permanent cross-language vector records the exact historical bytes, stored digest, current-v2
  recomputation, and expected quarantine result. Current navigation and explicit versioned visual
  packages retain their existing acceptance and tamper-denial behavior.

## N08-P03 production startup authority preflight

- The production entrypoint loads the storage adapter before the full application import. Missing or
  invalid durable storage authority therefore fails closed before database or application initialization.
- Valid production startup uses the same cached storage singleton and retains the existing readiness,
  listener, authentication, and durable-storage contracts. This repair changes no schema or persisted data.
- Every database startup initializer is registered on one ordered process-local queue. This preserves
  each initializer's existing fatal or nonfatal behavior while preventing independent PostgreSQL pool
  clients from deadlocking on overlapping DDL during a fresh production-artifact startup. Readiness
  remains closed until the entire queue drains successfully.
- The production-artifact gate requires an invalid authority child to exit naturally with the sanitized
  FEEDBACK_STORAGE_AUTHORITY_INVALID code and without readiness or TCP binding; the valid artifact must
  still start and pass the existing authenticated storage closure proof.

## N09-P04 Replit promotion liveness correction

- Replit deployment \`8809d211\` proved that application import and ordered database startup required
  23.889 seconds while Promote repeatedly rejected the unbound \`/api\` service. The process eventually
  bound correctly, but only after the provider's promotion health window had already failed.
- The entrypoint now binds immediately after the synchronous storage-authority preflight and before the
  full application import. Exact \`/api\` is a liveness-only HTTP 200 during that bounded interval;
  \`/api/v1/healthz\` stays HTTP 503 until the real Express application and startup barrier are complete.
- Initialization failure changes all bootstrap responses to HTTP 503 and closes the listener. Workers
  still start exactly once and only after the ready transition. This changes no schema or persisted data.

## Prework 06 connector and Coordination File foundation

- Connector credentials are provider/company scoped and persist only a protected ciphertext envelope, wrapped data key, and positive key version. Plaintext secrets are outside the persistence contract.
- Durable connector work uses one job authority with stable idempotency, payload digest, bounded attempts, scheduled retry, leased claims, fencing tokens, dead-letter state, explicit replay lineage and immutable attributable job events.
- A Coordination File is a stable project-scoped logical identity. Every provider revision is immutable and retains provider item/version identity, content SHA-256 and byte size; the current designation is held separately so revision evidence is never rewritten.
- SharePoint foundation maps each BIMLog project to an approved site/library and each category/optional trade to one folder. Delta cursor material uses the same protected-envelope model, while status, last sync and mismatch remain visible operational state.
- The forward-only migration is an explicit transactional operator action and is not called by application startup. This checkpoint provides no SharePoint synchronization worker, Outlook add-in, route, UI, deployment or live-database change.

## BT Folder Wizard publication candidate — Builds 16–20

- An existing project Files record and durable storage object provide the sole source custody. A read-only candidate verifies exact stored byte count and SHA-256, current Wizard import/routing profile, active mapped credential, and Graph-verified site/library identity.
- The deterministic candidate freezes the current source, routing fingerprint and drive-relative path into one request digest. An isolated Graph adapter can create a small file only with no-overwrite semantics, but no production route invokes that write transport.
- The authenticated project endpoint previews eligibility only. No delivery job, worker, retry, external file write or user-facing publishing control is activated by this block. A real authorized tenant/site round-trip remains required before delivery acceptance.

## BT Folder Wizard disconnected job foundation — Builds 21–25

- A deterministic request can be frozen as a byte-free job. The queue adapter rechecks current project/company membership, Wizard import, routing profile, SharePoint mapping, active credential and durable Files identity inside one transaction before insertion and an immutable event.
- A separate worker boundary claims only Wizard publish jobs through a finite lease and fencing token, rechecks current source and destination authority, and can settle by exact lease into completed, bounded retry or dead-letter with an immutable audit event.
- These adapters are not mounted on a production route or scheduled. The visible publishing action stays disabled. Real PostgreSQL/provider round-trip, conflict reconciliation and user confirmation remain open; no SharePoint delivery is claimed.

## BT Folder Wizard confirmed publication candidate — Builds 26–30

- The queue, lease, retry, settlement and immutable event chain has isolated real-PostgreSQL proof. A project administrator previews a verified Files source and exact destination, confirms the digest, and can inspect project-scoped job status.
- The request-bound executor claims only the confirmed job, revalidates current project authority, source bytes and destination mapping, then uses a Graph upload session with create-only conflict behavior. An uncertain provider result reconciles only an exact drive, name, size and byte match; mismatches never overwrite.
- This is source and synthetic-provider acceptance, not a claim of real SharePoint delivery. The release still requires full local gate, exact GitHub/Replit identity, authenticated Chrome smoke, and an authorized tenant/site round-trip. No Native or Lens Next source changes are included.

## Coordination Delivery Release A — Build 1 service boundary

- The first delivery layer is provider-neutral and operates only through an injected transaction/store boundary; it is not connected to application startup, routes, UI or a live provider.
- Every revision or job command carries explicit project, company and attributable user scope. Persistence is unavailable until the store confirms that exact authority.
- Stable Coordination File identity and immutable provider revision evidence replay only when every authoritative field matches. Provider identity reused with a different hash, byte size, scope or classification fails closed.
- Current revision designation is explicit and compare-and-set guarded by the caller's observed revision. Job idempotency likewise accepts replay only when the request digest matches.
- This build adds no schema and activates no connector. It preserves the complete Prework 02–06 and MAIN 04 Build 47 lineage.

## POST-P18 Coordination Hub authorization hardening — Build 66

- Coordination summary and intake history remain readable by authenticated current-project members.
- Coordination intake analysis, intake confirmation, immutable revision registration, and connector-job enqueue are mutations and therefore require the established project \`admin\` or \`write\` permission on the server.
- Credential enrollment, rotation, validation, lifecycle visibility, and SharePoint mapping retain their stricter project-administrator boundary.
- Every command continues to replace caller-supplied scope with the authenticated route project, actor, and company context; provider revision identity and summary queries remain project-scoped.
- This correction changes no schema, stored record, connector activation, Native/Lens Next behavior, or deployment state.

## POST-P18 Coordination synchronization lifecycle — Build 67

- Connector-job enqueue and its first immutable lifecycle event are committed in one transaction. The sequence-1 event is bound to exact job, company, project, actor, provider, job type, and request digest evidence.
- Existing job states remain \`queued\`, \`leased\`, \`retry\`, \`completed\`, \`dead_letter\`, and \`cancelled\`; claims remain attempt-bounded, lease-aware, \`SKIP LOCKED\`, and fencing-token protected.
- Exact idempotent replay remains accepted only for the same request digest. Digest conflict fails closed, and terminal dead-letter jobs remain visible as attention items.
- This checkpoint activates no connector worker, provider call, migration, outbound action, or deployment.

## POST-P18 Coordination linked-record isolation — Build 68

- Generic linked-item creation accepts only the established authoritative entity types and positive numeric record identities.
- Before relationship persistence, both source and target records must independently exist in the exact requested project. Missing, malformed, unsupported, and cross-project endpoints fail closed.
- Relationship creation and removal affect only the project-scoped relationship and its activity evidence; connected authoritative RFI, Submittal, Transmittal, Change Order, Meeting, File, Clash, and Lens Next records are not mutated.
- Coordination File source revisions retain their independent same-project source-file proof, and action projections remain persistence-free proposals.

## Coordination Delivery Release A — Builds 2–11 contracts

- Builds 2–3 add an authority-scoped, read-only SharePoint discovery port and deterministic reconciliation. Discovery is bounded and credential references remain opaque; reconciliation never silently changes the current BIMLog revision.
- Builds 4–5 define a strict Microsoft Graph message envelope and deterministic project routing. Provider tokens are excluded, attachment identity is immutable, and zero or multiple project matches require review.
- Builds 6–7 define trade-file collection requests and immutable submission review. Requests bind project, company, trade, accountable contact, required artifacts, deadline and allowed formats; acceptance requires a clean malware result and an attributable human decision.
- Builds 8–9 separate accountability evaluation from outbound delivery. Overdue work proposes escalation, while external delivery remains an approval-gated, digest-bound, idempotent outbox intent; this checkpoint sends nothing.
- Builds 10–11 define composite source authority and QC decisions. A composite is blocked when any discipline is not the observed current revision, and approval is prohibited when blocking checks fail or applicable checks lack immutable evidence.
- All ten builds are provider-neutral or provider-bound contracts and pure services only. They add no routes, UI, startup hooks, schema, database application, provider activation, message sending, deployment or Native/Lens Next change.

## Coordination Delivery Release A — Builds 12–18 completion

- Builds 12–13 stage approved, digest-bound Procore return intent and preserve design comments against exact provider, project, Coordination File and revision evidence. No provider write is activated.
- Builds 14–15 project design comments and meeting-report commitments into the existing unified action authority. Meeting-derived actions remain proposals and carry the report snapshot digest, attributable principals, scope and due date.
- Builds 16–17 control For Record issuance and immutable delivery receipts. Issuance requires approved QC, the observed current revision, explicit recipients and human approval; provider outcomes replay only when immutable receipt evidence agrees.
- Build 18 evaluates one complete 18-gate release-readiness record and fails closed on any missing, duplicated or failed gate. Its contract requires the local checkpoint to attest that database application, provider activation, outbound messaging, deployment and publication are all false.
- The full 18-build Coordination Delivery roadmap is now implemented as locally tested contracts and service boundaries. Provider adapters, routes, UI, migrations, live activation and deployment remain separately reviewed delivery work rather than implied effects of this checkpoint.

## 120-build stabilization — Block 13 coordination records

- Issue/clash, RFI, submittal, transmittal, meeting, schedule, and change-order records now share one strict project-bound identity and link contract. Schedule placements participate in the same authoritative same-project check as the existing record families.
- Lifecycle actions use explicit per-record matrices. Reopen, revise, void, and reject require reasons, and accepted transitions append ordered actor/time/from/to evidence.
- Attachments, references, comments, responsible-company evidence, and notifications bind to the exact canonical record version. Attachment hashes and notification event keys are deterministic; evidence identities cannot be rebound.
- Saved views own filters, search, sorting, and page size. Screen pagination and PDF/CSV producers consume the same project-scoped filtered rows, preventing hidden or cross-project export divergence.
- Block 13 changes no schema, Native source, installer, provider configuration, or customer data. It is push-only; Build 070 remains the next publication milestone.

## 120-build stabilization — Block 14 Lens Next Platform sole-product completion

- The September 17 dirty mockup worktree remains preserved but is not a source authority. Its useful responsible-company behavior is implemented without its proposed schema: Lens Next combines names from exact-project membership and the existing Convention assignment response, deduplicates them, and never fabricates a company name from an unbound code.
- A tracked inventory mechanically separates Lens Next supported runtime, migration-only compatibility, governance, tests, and historical evidence. New unclassified Original/Legacy Lens, retired bundle, or \`lens-sync\` references fail the focused acceptance gate.
- The Lens Next Platform capability contract binds list/detail, grouping, filters, captured-image states, references, same-project RFI/Submittal links, responsive/keyboard behavior, and the truthful rule that a captured image is not interactive 3D.
- Create, Working View, repair, refresh, and reconciliation acceptance preserves exact project/model identity, idempotency, stale-response refusal, manual conflict handling, readback, and transaction rollback.
- Customer Platform source no longer presents Original/Legacy Lens. \`/lens-next\` is the sole Lens product route. The shared release identity advances only the Platform counter to \`v1.05.N18-P35\`; generated Native metadata remains behaviorally unchanged and requires focused dual-year package/contract smoke before push.

## Build 070 publication schema-correspondence correction

- \`job_activation_tasks\` lifecycle dates and predecessor identities are jointly owned by the Build 057 startup migration and the authoritative Drizzle schema. The declared contract includes \`start_date\`, \`due_date\`, \`predecessor_task_ids\`, and \`job_activation_task_dates_chk\`; provider synchronization may not remove them.
- Publication correspondence introspects the executable Drizzle schema and compares every table, explicit index, column, and table-qualified check constraint against both provider databases. Duplicate constraint names on different tables remain distinct, and the existing master-catalog aliases-array check is declared in both startup and Drizzle authorities. Any missing or extra column/check returns a stopped publication decision instead of a zero-change receipt.
- The first P35 provider preview exposed the prior mismatch against 18 populated records and was cancelled before promotion. Production remained unchanged; the corrective release must pass a fresh provider preview before publication.

## 120-build stabilization — Block 16 feedback and notifications

- Platform candidate \`v1.05.N18-P36\` completes the current ten-build publication batch through Build 080 with durable feedback recovery, canonical customer/reviewer routes, deterministic preferences, governed delivery contracts, and production-safe feedback-to-resolution acceptance.
- Replit remains the established publication provider. Publication uses Replit Shell and visible Chrome; Replit Agents are prohibited. No external email, Telegram message, or document is sent by the acceptance gate.
- Native behavior remains N18. Shared P36 metadata was rebuilt deterministically for Navisworks 2021 and 2025 without installation; installed compatibility and absence of customer-facing Legacy Lens remain a focused post-publication scan.

## Post-120 RFI frontend decomposition — Build 155

- Builds 151–155 isolate RFI list/query state, create evidence state, and permission-aware action presentation under \`artifacts/bimlog/src/pages/project/rfi-frontend/\`.
- The route, API contracts, database, customer data, Native boundary, installers, and release cadence are unchanged.
- The permanent Block 31 regression covers cross-role status actions and project-scoped deep links.

## Post-120 RFI backend decomposition — Build 160

- RFI query parsing, date bounds, ball-in-court derivation, filtering, and sorting are owned by one project-scoped query service used by governed PDF and Excel exports.
- Lifecycle administration and attributable audit-record construction are centralized without widening existing project-member, write, project-admin, or super-admin boundaries.
- The permanent Block 32 negative matrix denies project/object mismatch, non-admin lifecycle authority, malformed filters, and contradictory date ranges.

## Post-120 clash-report architecture — Build 165

- Clash import parsing, report-number allocation, and status presentation now have focused shared contracts instead of duplicated route-local implementations.
- Classic clash reads and mutations bind project, report, and clash identity through shared provenance predicates; cross-project and cross-object identities fail closed.
- Lens Next Visual Package completeness and reference-attachment presentation have one project-scoped truth source. Partial packages are explicitly invalid rather than silently presented as unavailable.
- The permanent Block 33 matrix covers large reports, exact chunk preservation, malformed AI output, duplicate identities, cross-project/object denial, and incomplete Visual Package denial.

## Post-120 meeting-minutes backend — Build 170

- Meeting command payloads, current-view query scope, and report presentation use bounded shared contracts instead of route-local interpretations.
- Participant and action-assignee identity normalization is centralized. Exact duplicate participant identities fail closed before persistence.
- The live meeting register, action list, PDF, native XLSX, and activity history consume one project-scoped scope contract; invalid date ranges fail closed.
- Create retries serialize under an actor/project/command-bound receipt and PostgreSQL transaction advisory lock. Concurrent meeting updates compare the observed version inside the update predicate and reject stale writers atomically.
- Block 34 changes no schema, Native source, installer, bridge protocol, provider configuration, or customer data.

## Route and interconnection integrity — Build 185

- The tracked route graph is generated by \`scripts/route-interconnection-graph.mjs\` and records frontend routes, project screens, navigation, frontend API references, API operations, and route-owned database tables.
- The normal pre-push gate rejects stale graph evidence, duplicate API ownership, unreachable project navigation, incorrect specific-before-generic ordering, or removal of the compatibility redirects for setup-guide and legacy Submittals tracking URLs.

## Open-loop current-authority reconciliation — Build 190

- Exactly one marked section in \`living-brief/OPEN_LOOP.md\` owns current open-loop truth; historical sections remain evidence and cannot become current by heading text alone.
- The generated disposition inventory classifies every open record, binds ownership and module/route responsibility, and links repeated historical statements to one canonical record.
- The normal pre-push gate rejects unresolved duplicate statements, competing or missing current markers, unowned records, route-less product work, and stale contradictions classified as active.

## Browser performance and lazy-loading integrity — Build 205

- The production Vite manifest is the machine-readable authority for initial-entry and route-owned browser chunks.
- Anonymous startup excludes authenticated feedback tooling. Authenticated feedback mounts after a bounded 400 ms delay with teardown cancellation.
- Capture markup editing is a separate deployment-recoverable dynamic entry keyed to the selected file, preventing stale editor state from crossing captures.
- Reports and convention editing remain independently lazy project workspaces. Initial-entry, route-chunk, total-JavaScript, feedback, and editor size budgets run in the normal pre-push gate.

## Coordination Knowledge Resolution Records — Builds 256–260

- The canonical coordination issue remains \`lens_viewpoints\`. A Resolution Record is a company/project/issue-scoped outcome and history object; it never becomes a second issue authority and cannot be rebound across tenants, projects, or issues.
- Resolution Records reference only reviewed Resolution Methods, preserve the selected method and actual field outcome, and append immutable revisions for draft save, completion, verification, and reopening. Optimistic concurrency rejects stale writers.
- Before, after, and supporting evidence remain project-file/revision scoped. Linking evidence records metadata and the immutable model-view reference without copying file authority or weakening the established project attachment boundary.
- Completion may occur directly from a valid first submission. Verification is a separate accountable action, and the resolver cannot verify their own resolution. Reopening requires an attributable reason and preserves the prior completed and verified history.
- Lens Next exposes this workflow in its existing issue-detail surface. The API, Platform client, and UI share the same action vocabulary, role checks, version, and audit outcome; Native bridge and installer contracts are unchanged.
- Builds 256–260 are a source-only five-build push boundary. No provider migration, customer data mutation, Replit publication, or external delivery is implied; publication and authenticated Chrome acceptance remain due at Build 265.

## Coordination Knowledge Lessons Learned — Builds 261–265

- A Lesson Learned proposal is a company/project-scoped review object linked to the exact canonical Project Case, closed Resolution Record, classification, and supporting evidence. It never replaces or changes the source issue.
- Lens Next exposes the proposal action only for a completed or verified outcome with evidence. The authenticated Coordination Knowledge Library exposes the live company-scoped queue and controlled proposed, under-review, approved, rejected, and merged states.
- Reviewer decisions are optimistic-concurrency protected, attributable, rationale-bearing, and audited. Duplicate proposals may merge only into a same-company canonical proposal and retain their redirect history.
- An approved proposal may create or revise draft Conflict Types, Coordination Rules, or Resolution Methods through a separate controlled action. No proposal, review transition, or merge automatically approves or publishes organizational knowledge.
- Block 8 adds no schema and changes no Native, bridge, camera, installer, package, Autodesk load path, or Navisworks-facing source. Build 265 is the scheduled Replit publication and authenticated Chrome acceptance boundary.
`;

  const outDir = path.join(REPO_ROOT, "living-brief");
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, "PLATFORM.md");
  const prior = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null;
  if (prior === content) {
    console.log("[generate-platform-md] living-brief/PLATFORM.md unchanged");
    return;
  }
  fs.writeFileSync(outputPath, content, "utf-8");
  console.log("[generate-platform-md] wrote living-brief/PLATFORM.md (structural change)");
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedDirectly) generatePlatformMd();
