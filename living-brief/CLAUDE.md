# AI_DEV.md / CLAUDE.md - BIMLog AI Development Operating Manual

This file is the operating manual for any AI development partner (Codex / Claude / Replit Agent)
working on BIMLog. Read it at the start of every session before making changes.

[ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md) is the permanent product-doctrine authority
beneath Roberto's explicit current instruction. This manual owns agent execution rules; it does
not redefine ecosystem identity, permanent product laws, standards metadata, or acceptance rules.

Preferred future filename: AI_DEV.md. Keep CLAUDE.md as a compatibility alias until the
Living Brief UI and any agent tooling can read AI_DEV.md directly.

## Who / What
- Product: BIMLog, a construction coordination platform.
- Owner: Roberto Rodriguez, CEO of BIMCapital Partners INC / IgniteSmart.
- Primary field user: Ruben Crespo (rubenc@bimcorpgroup.com), first Founding Partner.
- This is a multi-session build. Context is preserved through the Living Brief documents
  in this folder: CLAUDE.md, PLATFORM.md, STATUS.md, VISION.md, PLUGIN.md, QUALITY.md, OPEN_LOOP.md.

## Standing Workflow Rule - read before touching anything
Talk through the full goal and agreed design BEFORE writing code when the user is still
asking design/product questions. Once the user approves direct edits, build in small,
independently verified steps. Read the real current code before editing it. Never patch
from memory of what a file "should" contain. Verify every change landed with grep,
typecheck, build output, or a focused runtime test before moving to the next change.

Every focused directive must begin with this operating sentence:
`Stop any unrelated prior work. Verify the real repository and governing documents before editing, then proceed directly with the authorized scope.`

"Stop unrelated work" does not terminate the authorized task. A task with authorized
implementation must not create a plan and wait: verify first, report the baseline briefly,
and continue. A read-only request must remain read-only. An implementation request must
proceed after verification. A genuine authorization boundary stops the task and requires
Roberto's decision.

## Owner authority and document precedence
Development governance follows this hierarchy:
1. Roberto's explicit current instruction.
2. [ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md).
3. [CLAUDE.md](./CLAUDE.md) / future AI_DEV.md execution rules.
4. [QUALITY.md](./QUALITY.md) acceptance requirements.
5. Relevant module documents such as [PLUGIN.md](./PLUGIN.md) and
   [REPORT_DESIGN_SYSTEM.md](./REPORT_DESIGN_SYSTEM.md).
6. [STATUS.md](./STATUS.md) current implementation state and
   [OPEN_LOOP.md](./OPEN_LOOP.md) unfinished work.
7. [AUDIT.md](./AUDIT.md) append-only history.

Agents may not override the Living Brief with invented restrictions or assumptions. Ask
Roberto when governing documents genuinely conflict. A newer explicit Roberto decision
requires the affected Living Brief document to be updated. Technical implementation details
remain governed by the relevant module document when they do not conflict with higher
doctrine. The Living Brief exists specifically to prevent repeated instructions and agent
assumptions.

### Mandatory reading order

Before making changes, read in this order:

1. [ECOSYSTEM_DOCTRINE.md](./ECOSYSTEM_DOCTRINE.md)
2. [CLAUDE.md](./CLAUDE.md)
3. [QUALITY.md](./QUALITY.md)
4. Relevant module documents
5. [STANDARDS_REGISTER.md](./STANDARDS_REGISTER.md) when standards are implicated
6. [STATUS.md](./STATUS.md)
7. [OPEN_LOOP.md](./OPEN_LOOP.md)
8. [AUDIT.md](./AUDIT.md) when historical evidence is required

`STANDARDS_REGISTER.md` owns verified standards titles, editions, applicability, evidence
expectations, and claim restrictions. Do not duplicate or infer that metadata here.

## Master Codex / focused task-chat operating rule
- When Roberto designates the current Codex task as the master coordinator, it verifies the
  real repositories and governing documents, reconciles requirements, and produces focused-task
  instructions on screen. It does not implement feature source code while designated as master.
- The master does not create, send to, archive, rename, or otherwise manage tasks unless Roberto
  explicitly requests that action. It independently reviews focused-task evidence, does not
  accept a builder's report as proof, and declares whether each acceptance gate passed or failed.
- Every focused-task directive must name the real repository explicitly. The BIMLog platform
  repository is `C:\Dev\bimlog`; never assume the task chat's mounted folder is the repository.
- The directive must require the task chat to verify `git status`, recent commits, and the
  complete current implementation before editing. It must list the exact files that must be
  read first, define files/modules that are out of scope, define required behavior and
  non-regression constraints, and finish with exact verification and final-report requirements.
- Focused task chats must verify against the repository and current runtime evidence, never
  compressed chat memory. If a claimed defect is not reproduced, they must report the evidence
  rather than creating a duplicate control or alternate workflow.
- The master task records every discovered, completed, or deferred product item in
  `OPEN_LOOP.md` so Roberto does not have to repeat cross-task instructions.

A focused builder reads the real implementation, changes only the authorized scope, preserves
unrelated work, and produces evidence. Its report must distinguish implemented, locally
verified, deployed, and customer-verified states. The builder cannot approve its own acceptance
gate or declare the overall feature complete until independent review and every required gate
passes.

## Evidence and Release Gate - mandatory
Every change is evaluated through four independent gates. The task must name the highest gate
actually achieved and must not collapse implementation, verification, release, and field use
into "complete."

### 1. Source Gate
Requires actual diff inspection, an exact changed-file list, proof of architectural requirements
in source, a duplicate-implementation search, and confirmation of no unrelated changes. Production
behavior must contain no mock behavior, silent fallback, or TODO/FIXME that defers required work.
Run typecheck and build where relevant. Typecheck and build prove only compilation and
buildability; they do not prove correct behavior.

### 2. UI/Behavior Gate
Requires evidence from the real behavior. Static HTML recreations, handcrafted pages imitating
the production UI, synthetic acceptance screenshots that do not render production components,
screenshots with invented fields or controls, grep output presented as interaction proof, and
component fixtures that duplicate production markup are prohibited.

A test-only harness is permitted only when it imports the actual production component, does not
duplicate its markup, keeps fixtures outside production behavior, and is excluded from production.
The evidence report must identify the imported production component and fixture location and state
the limits of fixture testing.

Behavioral proof must match the workflow. Examples include: Add Reference add/display/save/reload/
remove; edit/change/save/reload/compare; crop visual manipulation/save/reload/export; close/reopen
with state and audit verification; multiple same-viewpoint RFIs with separate requests, IDs,
numbers, and files; and Copy Email clipboard output plus visible success/failure state.

### 3. Artifact Gate
Generated files must be opened and inspected. An HTTP 200, successful download, or file existence
does not prove that an artifact is useful or complete.

- PDF: inspect page count, dimensions, MediaBox/CropBox/rotation where relevant, every rendered
  page, extracted text, embedded images, page numbering, headers/footers, fingerprint, and
  attachment completeness.
- DOCX: validate the package; inspect page size, sections, and embedded media; render with an
  Office-compatible converter; visually inspect every page; verify headers, footers, tables,
  numbering, images, and content.
- Spreadsheet: open or render every sheet; verify relevant formulas/values, printable sheets,
  page setup, and orientation.
- Plugin: when shared code changes, build both documented physical versions at
  `C:\Dev\BIMLogPlugin\BIMLogNavisPlugin` and `H:\BIMLogPlugin2025`; preserve intentional
  project/reference differences; verify framework, AnyCPU target, version, DLL, PDB, and package
  ZIP. Compilation is not live Navisworks verification.

### 4. Deployment/Field Gate
Report these states separately: committed, pushed, available in the Replit workspace, built in
Replit, published, live verified, and customer/field verified. Never collapse them into
"complete." Publishing, production migration, DLL installation, external deployment, and
production-data mutation require Roberto's explicit approval.

### Builder evidence and prohibited proxies
The task that implements a change may report evidence but may not approve its own acceptance
gate. The master coordinator or Roberto must independently inspect the evidence. A builder's
claim that work is "complete," "verified," or "passed" remains provisional until independent
review.

Prohibited proxy substitutions include similar headings instead of shared components; code
presence instead of behavior; grep instead of interaction; static mockups instead of real UI;
typecheck instead of persistence; build instead of artifact inspection; local fixtures instead
of deployed acceptance; file existence instead of a useful complete artifact; and explicit error
reporting instead of support for the required workflow. If the real acceptance environment is
unavailable, report the missing evidence honestly. Never manufacture substitute evidence.

## Blockers and work preservation
- An external blocker does not authorize discarding source work.
- Before any cleanup, preserve `git diff --binary` in a Roberto-approved recovery location and
  report that path.
- Do not reset, restore, or remove work merely because a server, port, permission, converter, or
  runtime is unavailable.
- Work may be implementation-complete but validation-pending; label that distinction accurately.
- "Blocked" does not mean "nothing completed."

## Preserve-first development and terminal reporting rules

### Immediate Living Brief capture - do not batch hazards

In the same task or correction chain, update the applicable Living Brief authority or record an explicit semantic
review for: customer-impacting defects/regressions; repeated or systemic failure classes; protected working
baselines; migration, Git/rebase/publish/deployment/production/rollback hazards; security, privacy, tenancy,
authorization, idempotency, concurrency, evidence-integrity, or financial-control findings; a permanent instruction
Roberto has had to repeat; a blocker/correction that changes future builder behavior; or field findings that
contradict automated evidence. Small isolated same-session details may wait only until normal Ready/acceptance, and
still require a semantic-impact declaration before acceptance or push.

Progress updates are not terminal summaries. Every Replit, Codex, Claude, or other builder task ends with objective
and outcome; starting/final commit and ancestry; exact changed files; root cause/correction; validation/evidence and
limitations; clean/dirty status and push/publish/deploy/production-access state; blockers, pending acceptance, exact
next action; and Telegram EventId/message ID or explicit delivery reason. Prompt for the full summary if missing.
Every Replit instruction explicitly requests it. Git/publish work must additionally report actual HEAD/origin,
dirty/stash/rebase state, exact migration preview/operations, production reads/writes, and push/publish state.

Telegram is the terminal-turn return-to-computer alert, not only a completion notice. Every explicitly assigned task
work cycle sends exactly one structured sanitized Telegram notification immediately before its final response or idle
state whenever autonomous work stops: Completed, Ready/local candidate, partial safe stop, Blocked, Needs Input,
Failed, Paused/Held, or no-change audit. Use the honest supported status; reserve Completed for genuine completion,
otherwise use Info/Blocked/Failed/Needs Input with a clear terminal outcome and next action. Ready and Completed are
separate stopped work cycles and may each notify once with different EventIds. Do not send periodic noise while work
continues. If delivery is blocked, the final response prominently states the exact non-sensitive blocker.

Telegram Product Build 6 evidence uses the real built API and production UI components against the existing
isolated localhost `bimlog_rfi_test` harness only. Its deterministic RFI adapter must prove durable source-event
idempotency, delivery-time authorization/preference/watch rechecks, restart/no-resend behavior, bilingual desktop
and 390px browser behavior, privacy, cleanup, and zero automatic AI use. Local evidence can make a candidate Ready
for independent review; it cannot mark the build accepted, pushed, published, deployed, or customer-verified.

Living Brief gate recovery must not be circular. A currently authenticated and transaction-time revalidated Super
Administrator who has lost the gate password must be able to recover without already holding a Living Brief access
token. Recovery still requires current BIMLog account-password revalidation, exact confirmation, bounded reason,
rate limiting, advisory/row locking, stale observed-version protection, immutable audit, rollback safety, and
invalidation of prior brief sessions. Ordinary users, Project Admins, and Company Admins remain denied.

### Mandatory capability preflight

Before work needing Git writes, deployment controls, production-schema inspection, external notifications,
administrator rights, GUI interaction, or protected filesystem access, test and report whether the active environment
can perform each operation. Split agent-capable and operator-only steps at the start. If Replit cannot write `.git`,
it prepares a reviewed patch/content set and safe operator commands; it does not start a rebase or promise commit/push.
Never send a background isolated copy to rewrite the main environment's history.

Prefer a clean latest-origin branch/worktree and one reviewed integration commit. Exclude empty publish commits,
pasted instructions, generated noise, and cosmetic lockfile churn before push. Before any user-run Git command verify
HEAD/origin, dirty/stash/rebase/lock state, authorized files, rollback/backup, and discard risk. Replit instructions
name operator-only steps up front; terminal summaries disclose platform-blocked and manually performed actions.

### Publish supply-chain preflight

Deployment preflight reproduces the production/publish dependency-install policy; a development install is not a
proxy. Before republish, scan the complete frozen transitive lockfile across every workspace, including Electron,
native rebuild, `node-gyp`, packaging, optional, and other build tooling. Classify the dependency as runtime,
development, packaging, or optional tooling so unrelated schema/application work is not blamed.

A security override is minimal, explicit, version-bounded, explained, verified in the lockfile against every
dependent range, and followed by proof that the blocked version resolves zero times and the approved version resolves
consistently. Run a frozen clean install and all affected builds before push/publish. Never use broad `git commit -am`;
preflight exact dirty files and commit only authorized `package.json`/`pnpm-lock.yaml` changes after independent diff
review. A blocked publish gets an immediate terminal summary naming stage, artifact/version, cause, correction,
validation, Git/production effects, and next action. Do not retry an identical blocked publish without validated
dependency-state change.

This monorepo's sole pnpm override authority is `pnpm-workspace.yaml`. Never add a competing root
`package.json` `pnpm.overrides` block. A targeted security fix preserves the complete existing override/exclusion set
and proves a tar-only semantic delta: zero lost controls and zero unrelated importer, version, integrity, optional,
platform-binary, or resolution changes. Removing the target vulnerability does not justify weakening another
supply-chain control. Preserve rejected Replit checkpoint evidence; make the correction from clean pushed master,
without `git reset --soft` or further Replit Git surgery.

Replit may create an automatic checkpoint despite an explicit validation-only/no-commit instruction. Every Replit
terminal summary therefore includes fresh `git status`, HEAD, `origin/master`, last-commit stat, and effective diff;
the requested boundary is never trusted without verification. A checkpoint is an unaccepted candidate. Large
lockfile churn requires semantic audit of workspace importers, package versions, integrity data, optional dependencies,
and resolution behavior—not only a text search. Regenerate with the repository-pinned package manager/workspace
configuration and record tool/version. If a checkpoint is mechanically broad, replace it with one clean reviewed
commit instead of appending a cleanup commit.

### Default tool-responsibility boundary

Codex/controlled local clean worktrees own source investigation/edits, dependency and lockfile changes,
tests/evidence, clean commits, independent review/integration/normal GitHub push, Living Brief semantics, and
package/plugin builds and reviewed artifacts. Replit owns only pulling an already verified/pushed `origin/master`,
showing the actual publish migration preview, publishing after explicit approval, runtime health/log verification,
explicitly authorized read-only production diagnostics, and the complete terminal deployment summary.

By default Replit performs no source fix, dependency edit, lockfile regeneration, Git surgery/rebase/ref movement,
cleanup commit, automatic product-outbox test, development-to-production data copy, destructive migration approval,
or acceptance of an automatic checkpoint as history. If publish-only evidence identifies a source/dependency fix,
Replit diagnoses and reports, then stops. A controlled local task implements, reviews, and pushes the correction;
Replit pulls that verified commit and retries. An exception needs Roberto's explicit scoped approval after preflight.

### AI CEO / lifecycle-network execution boundary

BIMLog's approved lifecycle-network roadmap uses Roberto, the master orchestrator, focused product agents,
research/market agents, security/privacy/quality agents, and human experts as a controlled execution system.
Roberto retains strategic, financial, legal, safety, production, credential, publish/deploy, and external-action
authority. No agent may convert a roadmap hypothesis, market scenario, AI recommendation, or executable-rule draft
into a contractual, financial, safety, production, or customer-facing action without explicit authority.

The master/orchestrator maintains canonical priorities, dependencies, conflict maps, evidence, handoffs, and Living
Brief reconciliation. Focused product agents build bounded capabilities only after reading the current source and
governing authorities. Research/market agents validate assumptions, regulations, standards, customer pull, pricing,
unit economics, and partner requirements before a roadmap claim becomes implementation scope. Security, privacy, and
quality agents enforce authorization, tenancy, evidence, metric integrity, deployment, and terminal-notification
gates. Customer feedback from Ruben and future users must be generalized into reusable capabilities; it must not
become customer-specific hardcoding unless Roberto explicitly approves a scoped exception.

Autonomous action expands only after evidence, controls, reversible scope, and explicit approval. Existing-task-first,
task/repository preflight, capability preflight, cost-control validation modes, bounded evidence, and terminal-turn
Telegram notification remain mandatory for lifecycle-roadmap work. Future Replit or Codex instructions for roadmap
implementation must state the exact task owner, phase, repository, allowed files, stop conditions, validation mode,
operator-only steps, and terminal summary/notification requirement before paid work begins.

Lifecycle roadmap agents must preserve organizational-excellence and adoption boundaries. EFQM, PHVA/PDCA, Prosci
ADKAR, and ASQ resources may guide strategy, continuous improvement, adoption planning, and quality analysis, but an
agent may not claim certification, endorsement, partnership, licensing clearance, or implemented methodology from
reference text. Before using branded templates, copied proprietary content, formal assessment language, training
materials, or certification claims, create an explicit licensing/trademark/current-version review item and stop for
Roberto's approval.

### Defensive security execution boundary

BIMLog security work is authorized only when it is explicitly defensive, bounded, and limited to BIMLog-owned source
or disposable local fixtures. Default validation uses source review plus small deterministic below-limit and
just-above-limit fixtures. Do not request or generate exploit payloads, unbounded resource-exhaustion tests,
credential theft, external targeting, persistence, evasion, destructive behavior, or live-customer testing.

If a model or product safety notice blocks or hides security output, stop repeating or trying to circumvent that
specific blocked request/output and preserve state. Do not repeatedly retry, bypass, obfuscate, seek a more permissive
model, weaken safeguards, duplicate tasks, discard clean candidates, or rerun expensive unchanged gates. Rephrase
toward legitimate bounded defensive application-quality verification and continue other safe engineering steps.
Trusted Access may help legitimate advanced security research if it is misclassified, but it is optional and never
replaces OpenAI policy or BIMLog security controls. Never infer account suspension or product compromise from one
persistent safety notice; report only the visible fact and use official support/account channels if an actual account
notice appears.

Security summaries and Telegram notifications are sanitized: no exploit instructions, vulnerability internals,
sensitive architecture, repository metadata, secrets, credentials, customer data, or private billing information.
Living Brief impact enforcement remains strict and composable: a security candidate may not fabricate declarations for
unrelated pending Living Brief edits, and the gate is never disabled, bypassed, loosened, or falsified to make a build
pass. Integrate the owning Living Brief corrections first; then rebase or reapply the preserved security candidate and
declare only its effective changed paths and genuinely affected authorities.

### Temporary owner credential continuity exception

During ongoing platform development, Roberto has approved a temporary continuity exception: current working integration
credential material remains operational and unchanged because prior rebuilds repeatedly lost or replaced configuration
and forced manual re-entry. This is not the desired launch architecture. Until Roberto separately approves final launch
hardening, no task may rotate, revoke, delete, replace, relocate, regenerate, invalidate, print, copy, quote, transmit,
or test those credentials, nor change provider, callback, or authentication behavior. No build or correction may require
Roberto to re-enter credentials. Future credential mutation requires fresh explicit Roberto approval.

The accepted Phase 1A continuity record lives at
`docs/portability/PHASE_1A_CREDENTIAL_CONTINUITY_EXCEPTION.md`. Before and after later portability work, run
`node scripts/check-credential-continuity.mjs`. The guard compares the complete protected Replit configuration with
the owner-approved baseline, emits generic pass/fail output only, and stops on mismatch, absence, or read failure.
Never print either fingerprint or inspect/replace values to resolve a guard failure; return the mismatch to Roberto.

Before public/production launch, this exception becomes a mandatory blocker requiring a separately approved
managed-secret migration, durable backup/recovery, controlled rotation/revocation as appropriate, callback continuity,
rollback proof, history remediation, and independent verification. Evidence and summaries remain value-blind: never
record secret values. This exception does not weaken the separate Living Brief gate-password durability correction,
which still requires durable database authority, no reseed/overwrite, controlled Super Administrator recovery, and
independent rollout verification.

- Read the complete relevant implementation, authority documents, and protected behavioral baselines before
  editing. Preserve working behavior and surround a protected invariant with new safeguards; never replace it
  from an incomplete excerpt.
- Never guess customer, company, project, model, file, or record identity from a label or chat shorthand.
  Resolve it from authorized canonical evidence or stop at the field-acceptance boundary.
- Start integration from a clean worktree at the latest fetched `origin/master`; apply only the reviewed
  change, preserve newer accepted history, and never use destructive Git operations to simplify reconciliation.
- A build, hash, response, screenshot, or local automation result proves only what it observed. Use real
  artifact/runtime evidence, report exact terminal states, and require field acceptance when local automation
  cannot prove the saved/reopened model or customer workflow.
- Every genuine terminal outcome requires the explicitly requested sanitized Telegram notification and an
  exact summary of commit, evidence, delivery/publish state, remaining gates, and failures. Ready is not Completed.
- Replit instructions inspect current workspace and schema state, forbid destructive publish SQL, avoid
  interrupted-history guesses, and separate build, schema preview, publish, and live verification. Production
  or customer access, mutation, publish, deployment, and external contact require explicit authority.

## Explicit authorization boundaries

Roberto must explicitly approve before directing system/global dependency installation, Windows
service creation or modification, database creation, a new test environment or harness,
administrator/elevated operation, process termination, firewall or network exposure,
production/Neon access, production-data mutation, Replit publish, DLL deployment/installation,
an external paid service, or new Codex task creation or task management by the master.

Repository-local implementation dependencies may be added only when directly required by the
authorized feature, with the exact package and reason reported. Never approve `DROP TABLE`,
`DROP COLUMN`, `DROP INDEX`, or force-push.

## Focused scope and plugin synchronization
- One focused behavioral slice per build, with explicit in-scope and out-of-scope files and an
  acceptance matrix. The next build starts only after independent review of the current gate.
- Divide large features into separately verifiable commits. Do not use "complete" in a commit
  title unless the complete acceptance matrix passed.
- Shared plugin changes require review and synchronization of both 2021 and 2025 physical source
  locations. PLUGIN.md governs build and packaging requirements, including intentional
  differences. Absence of Git history in the physical plugin source folders is not automatically
  a blocker.
- Source synchronization, build, and packaging are separate from live DLL installation. Live
  installation requires explicit approval. Agents must not invent a restriction that contradicts
  PLUGIN.md.

## Standing Rule - never dictate implementation to Replit
When writing instructions for Replit, give the goal and real constraints, not exact code,
column names, or transaction patterns to follow verbatim. Replit may know the running
workspace state better than an outside prompt. Exception: hard correctness constraints
are fine to state explicitly, such as "Edit must not consume a fresh sequence number; it
must inherit the old one."

## Standing Rule - platform and plugin share one display contract
The Navisworks plugin and the platform web UI display the SAME underlying lifecycle/chain
data: revisionNumber, supersedesId, lifecycleStatus, issueGroupId.

Shared clean field set:
ID - Trade-Seq - Rev N only if greater than 1 - State only if not active - Floor - Group
only if grouped.

Full detail such as who, why, when, superseded-from belongs in on-demand detail: comment,
history panel, edit reason, or lineage row. Do not cram it into a headline, title, or
inline badge. If one side's design changes, the other side must be reviewed too.

## Owner preferences - hard rules
- NO emojis anywhere: UI, code, comments, commit messages, docs, reports.
- Icons: lucide-react only. No other icon sets, no emoji icons.
- NO mock data and NO silent fallbacks. If something fails, fail loudly and explicitly.
- Prefer plain-text raw output. Do not hide output in collapsed boxes.
- Be terse. Do not over-explain.
- Do not make major plugin workflow changes without walking Roberto through the user flow first.

## Encoding / UTF-8 release gate
- Before every production build, publish, or Replit instruction that asks for a build, run
  `pnpm run check:mojibake`.
- If the scan reports any active-source hit for mojibake markers such as U+00C3, U+00C2,
  U+00E2, U+FFFD, or common pasted corrupted punctuation patterns, STOP and fix it before
  publishing.
- Do not "fix" Spanish by deleting Spanish. Proper Spanish UTF-8 is allowed when needed.
  Mojibake is caused by reading valid UTF-8 through the wrong encoding path.
- The scanner intentionally ignores binary assets, archives, dependencies, build output,
  uploads, and attached_assets paste archives. User-facing app source, emails, PDFs,
  API messages, reports, and Living Brief docs must stay clean.
- HTML pages, API responses, email bodies, generated PDFs, CSV/Excel exports, and imported
  text paths must explicitly preserve UTF-8. If a pasted string renders corrupted in the UI,
  repair it immediately at the source and rerun `pnpm run check:mojibake`.
- Do not publish if `pnpm run check:mojibake` fails.

## Living Brief integrity release gate

- Run `pnpm run check:living-brief` after Living Brief governance changes and before every
  production build. The root build runs it automatically after the mojibake check.
- Do not publish while the integrity check fails; fix the reported document, link, authority, or
  standards-source error first.
- `living-brief/catalog.json` is the single authoritative document catalog. The checker,
  deterministic PLATFORM generator, API, database mirror, frontend tabs, Copy Full Brief, and
  Export current docs must consume that catalog rather than maintain separate filename lists.
- `living-brief/state.json` records deterministic hashes, the accepted reconciled-through commit,
  source-change metadata, and the reviewed implementation impact set. Update it with
  `pnpm run living-brief:state -- --reconciled-through <full-accepted-commit>
  --candidate-changed-at <fixed-ISO-time>` only after the narrative documents are truthful.
  The command updates metadata only; it never invents or auto-writes narrative.
- Living Brief text hashes use canonical UTF-8 with LF line endings. They must remain identical
  across Windows and Linux checkouts; never hash checkout-specific CRLF bytes as source identity.
- A clean integration that changes implementation must reconcile `OPEN_LOOP.md`, `STATUS.md`, and
  every module document required by the catalog impact rules. A bounded audited not-applicable
  declaration may replace a module edit only when the change truly has no module-document impact.
- Production source without `.git` is validated from committed catalog/state hashes. The runtime
  must receive `BIMLOG_SOURCE_COMMIT` so the database mirror records the exact deployed commit;
  it must not invent a commit from a database timestamp.

## Architecture rules
- Monorepo: pnpm workspaces. See PLATFORM.md for the full map.
- Backend API is Express; every route is mounted under the global prefix `/api/v1`.
  - res.redirect in route files MUST include the `/api/v1` prefix or it 404s.
- Schema lives in `lib/db/src/schema/*` (drizzle). Every schema change must be made in
  BOTH the drizzle schema file AND the idempotent startup migration block in
  `artifacts/api-server/src/app.ts` using ALTER TABLE or CREATE TABLE IF NOT EXISTS.
- Route ordering: literal sub-paths such as `.../lens-pull`, `.../plugin-pull`, `.../active`
  MUST be registered before parameterized catch-alls like `.../:reportId`, which have no
  NaN guard.
- Soft-delete DELETE routes live inside their feature route files, not a separate file.
- Frontend is React + Vite + wouter. Protected pages use the `ProtectedRoute` wrapper,
  which reads token from `useAuthStore` and redirects to `/login`.
- bimlog build requires PORT to be set: `PORT=3000 pnpm build`.
- api-server builds to `dist/index.cjs` via esbuild. The bundle-size warning is normal.
  Restarting the API re-runs the migration block.

## Auth model
- JWT Bearer tokens. Payload carries `isSuperAdmin`.
- `authMiddleware` verifies the token.
- `isSuperAdminMiddleware` re-checks `users.is_super_admin`.
- Super admin is the boolean column `users.is_super_admin`, data-driven and not a hardcoded email.
- Super admins bypass project membership checks through `requireProjectMember`.
- Admin routes pattern: `router.get("/admin/...", authMiddleware, ...)`.
- bcryptjs is already installed. Use it for all password hashing.

## Living Brief specifics
- All 11 catalog documents are Git-controlled authorities. Database content is an exact verified
  mirror of the deployed source bundle, never an independent doctrine authority.
- Living Brief gate credentials are durable database security state. A build, startup, restart,
  migration, source mirror reconciliation, or Replit publication must never create, replace,
  rotate, clear, reseed, or invalidate an existing gate credential. Startup may migrate an
  existing legacy hash into the dedicated gate table once; otherwise it fails closed until a
  currently authenticated, revalidated Super Administrator performs the controlled bootstrap/reset
  workflow with reason and audit. Never seed a hardcoded/default gate password or place a gate
  credential in source, generated files, browser storage, process memory, deployment filesystem, or
  a build-time default.
- Doctrine and narrative documents are owned/hand-edited by Roberto and authorized development
  partners. `STATUS.md` is reconciled manually from accepted evidence. `AUDIT.md` is append-only
  history and must label dated findings as historical rather than present truth.
- PLATFORM.md is AUTO-GENERATED at build time by
  `artifacts/api-server/scripts/generate-platform-md.ts`. It contains only structural facts and
  writes only when those facts change; builds must not create timestamp-only churn. Do not hand-edit
  PLATFORM.md. Edit the generator instead.
- Living Brief docs are served by `artifacts/api-server/src/routes/living_brief.ts` under
  `/api/v1/living-brief/*`, gated by password plus eligibility check:
  super admin OR `users.can_access_living_brief`.
- Only a currently authenticated, currently revalidated Super Administrator can change the gate
  credential. Project Admin and Company Admin authority never imply this power. Reset requires
  bounded input, explicit confirmation, rate limiting, a reason, immutable audit history, and
  controlled Living Brief session invalidation. The locked public screen must not expose a reset
  form or reveal credential metadata.
- Ordinary read access always receives the verified deployed source bundle. Admin reconciliation
  may copy that exact bundle to a mismatched database mirror only with observed current hashes and
  one transaction. The service takes and rechecks the complete source identity before and after its
  transaction-scoped advisory lock so a concurrent source change cannot be reported as success.
  Arbitrary pasted database-only doctrine is prohibited.
- The additive Living Brief mirror migration is the reusable
  `ensureLivingBriefMirrorSchema()` operation. Runtime evidence must exercise that exact operation
  and the real authenticated API against an isolated localhost PostgreSQL database; static mocks do
  not establish mirror acceptance.
- F5 ONLY routes eligible admins to `/living-brief`; Ctrl+R / Cmd+R remains normal refresh.
- PLUGIN.md holds the full Navisworks plugin reference and is not auto-generated.
- QUALITY.md holds the BIMLog Quality 4.0 doctrine derived from the Calidad 4.0 source
- OPEN_LOOP.md is the active unfinished-work register. Add anything not completed in the current task, move shipped work to Watching/Closed with commit or version notes, and read it at the start of every new task.
  material. Read it before product, UX, report, AI, data, audit, and plugin decisions.

## AI / model / cost patterns
- Roberto's internal/test users may use the platform Anthropic/Replit-backed key path.
- External users should move toward user-owned AI keys or a controlled included-credit model.
- AI usage must be logged per user, project, feature, billing mode, and credit unit.
- Super admin must be able to see AI usage by user, feature, project, and month.
- Expensive file-reading AI must be separate from cheap text assistance. Use explicit user
  confirmation before file-reading AI.
- Description/email assistance can be offered as lightweight AI, but still logged.
- If a user has not connected their own AI key and a feature would consume platform credits,
  show a clear warning before running.

## Database patterns
- Replit dual-database: shell/CLI may connect to `helium` dev DB. The app runtime connects
  to Neon production through `PROD_DATABASE_URL`.
- Never diagnose real production data by querying helium.
- Always confirm `PROD_DATABASE_URL` target before drawing production data conclusions.
- lens_viewpoints dedup: by `viewpoint_id`.
- `navisworks_guid` is normalized to null when zeros.
- lens_viewpoints active-scoped partial unique index:
  `(project_id, display_id) WHERE lifecycleStatus='active' AND display_id IS NOT NULL`.
- A display_id collision returns:
  `{success:true, skipped:true, reason:"display_id_collision", id:null}`.
  id is deliberately null so the client cannot mis-bind to a row it did not create.
- lens_viewpoints revision system:
  - Edit and Reassign create a NEW row, never mutate in place.
  - Old row becomes `superseded`.
  - New row gets revisionNumber old+1 and supersedesId old.id.
  - Edit inherits the same tradeFloorSeq.
  - Reassign draws a fresh number from the new trade's counter.
  - Void has the same active-only guard as Edit/Reassign.
- GET `/projects/:projectId/clash-reports/lens-viewpoints/:id/active` resolves a stale id
  to the real current chain tip.

## Navisworks plugin patterns - formats / config
- Plugin config: `%APPDATA%\BIMLog\config.json`.
- Debug/error log: `%APPDATA%\BIMLog\pending_action_error.log`.
- Plugin debug log must also mirror live in the panel when available.
- Viewpoint ID format: `{6 chars NWF filename}{6 chars GUID fragment}`, e.g. `1185RI-F70F14`.
- Jump to Viewpoint uses `/jump?code=displayId`, not `/jump/guid`.
- GUIDs are often null/zero in DB. Always jump by displayId.
- Build: AnyCPU, .NET Framework 4.8.
- Navisworks 2021 production path: `C:\Dev\BIMLogPlugin\BIMLogNavisPlugin`.
- Navisworks 2025 Ruben path: `H:\BIMLogPlugin2025`.
- Use version naming `v1.60.6`, `v1.60.7`, `v1.60.8`, etc. for plugin releases.

## Navisworks API lessons - never repeat these
- SavedItemCollection uses `.Add()` not `.AddCopy()`.
- GroupItem has no public constructor. Use `existingGroupItem.CreateCopyWithoutChildren()`.
- `doc.SavedViewpoints.AddCopy(folder, vp)` adds a viewpoint to a folder.
- `doc.SavedViewpoints.AddComment(vp, comment)` adds a comment.
- Comment constructor: `new Comment(body, CommentStatus.Active/Approved/Resolved)`.
- `Application.Idle` fires on the main thread and is safe for UI/navigation.
- Always queue Navisworks UI calls on the main thread.
- `set_CurrentSavedViewpoint` navigates to a saved viewpoint.
- Never call UI operations from background threads.
- `vp.Guid` returns all-zeros for viewpoints saved in previous sessions. Always jump by displayId.
- HttpListener works for local HTTP server on `localhost:8765`.
- Use DockPanePlugin, not DockableWindowPlugin.
- PlaceholderText is not available on .NET Framework 4.8 TextBox.
- Always reflect the DLL before assuming method names:
  `$dll.GetTypes() | GetMethods()`.
- Navisworks Color conflicts with System.Drawing.Color. Use a Drawing alias.
- Do NOT change GenerateFingerprint; it orphans existing rows.
- Do NOT delete clashes server-side between syncs; the plugin re-pushes everything.
- Plugin uses no-cors from HTTPS platform to `localhost:8765`. This is correct.
- Never use regex replace on method-level C# code. Rewrite the entire method/file cleanly.
- Always build AnyCPU, not x64.
- Always use HttpWebRequest inside the plugin. Never HttpClient or WebClient.
- Always use InvariantCulture for decimals. Spanish locale uses comma separator.
- `SavedViewpoint.CreateUniqueCopy()` inherits the entire comment history. Any "latest field"
  reader must use last-match-wins logic across all comments.
- A SavedViewpoint reference can stop matching by reference equality after tree operations.
  Match by DisplayName or stable metadata instead of `==`.
- Renaming a viewpoint after server round-trip can throw `Object is Read-Only`. Create/write
  the new visible record first, then attempt old-object rename in its own try/catch.
- Lens Edit endpoint is PATCH, not POST.

## Plugin files - complete list
- BIMLogPlugin.cs - entry point, DisplayName = BIMLog Pulse.
- ClashReader.cs - reads clashes, ClashData class.
- ClashTriage.cs - P1-P5, GUID fingerprint, trade detection.
- BIMLogApiClient.cs - HttpWebRequest, batch push, lens sync, Edit/Void/Reassign calls.
- BIMLogSyncForm.cs - Push/Pull/Open/Settings, F2 debug.
- SettingsForm.cs - URL, Email, Password, Project ID.
- PluginConfig.cs - config.json, sequence.json, synced_viewpoints.json, trade_floor_sequence.json,
  levels_cache.json.
- BIMLogLensPlugin.cs - DockPanePlugin.
- BIMLogLensButton.cs - AddInPlugin button launches the Lens panel.
- BIMLogLensPanel.cs - full panel: SaveViewpoint, SyncWithBIMLog, RefreshCounter, Manage Existing
  Viewpoint lifecycle system, live debug log, Active/History split.
- BIMLogLocalServer.cs - HTTP server on localhost:8765: ping, jump?code=displayId, jump-by-name.

## Three sync tools
- BIMLog Pulse - working - clash hits sync - DisplayName = BIMLog Pulse.
- BIMLog Lens - working - viewpoint sync, lifecycle system, Jump to Viewpoint.
- BIMLog Mirror - planned - bidirectional clash-detect sync using Navisworks Clash API.

## Replit instruction format - mandatory every time
When writing an instruction for Roberto to paste into Replit:
- Single code block so Roberto can click the copy icon.
- Opens with: Stop any unrelated prior work. Verify the real repository and governing documents
  before editing, then proceed directly with the authorized scope.
- Plain English, file by file. No numbered steps and no markdown headers inside the block.
- Checks using grep/find at the end.
- Mandatory mojibake check: `pnpm run check:mojibake`.
- Mandatory rebuild: `rm -rf artifacts/api-server/dist && cd artifacts/api-server && pnpm build 2>&1 | tail -3`.
- Rebuild both apps when frontend and backend both changed.
- Restart the API server after every backend rebuild.
- Publish only after all checks pass and Roberto explicitly wants publish.
- Print all check outputs as plain text. No collapsed boxes.
- Always ask Replit what it has already built before writing an instruction.
- Never direct Replit on implementation. Give context and goals; let Replit decide.

## What never to do
- Never add mock/placeholder data or silent try/catch fallbacks that hide failures.
- Never use emojis or non-lucide icons.
- Never change a schema in only one of the two required places.
- Never register a parameterized route before a sibling literal route.
- Never hand-edit PLATFORM.md.
- Never change GenerateFingerprint.
- Never delete clashes server-side between syncs.
- Never call Navisworks UI operations from a background thread.
- Never let plugin/platform invent independent display conventions for the same lifecycle data.
- Never push, publish, or rebuild production if `pnpm run check:mojibake` fails.

## BIMLog Quality Standard - mandatory on every build
QUALITY.md is the doctrine behind this standard. It makes Calidad 4.0 operational inside
BIMLog: spreadsheet-simple field workflows, clean structured data, traceable decisions,
human-reviewed AI, exportable evidence, audit-ready reports, and future digital-twin
readiness. Do not treat quality as visual polish only; quality is the full chain from data
capture to decision to report to audit trail.

### PDF Reports
- Every PDF has a cover page for formal documents or branded running header for logs.
- Every PDF has company logo via getCompanyLogo.
- Every PDF has page numbers Page X of Y using bufferedPageRange and switchToPage.
- Every PDF has a consistent footer: BIMLog by IgniteSmart, timestamp, report number.
- Every PDF has SHA-256 fingerprint of the data snapshot on the last page.
- Monochrome design only: navy section header bars (#1E3A5F), white content, alternating
  light grey rows (#F8FAFC), black text throughout.
- No color badges anywhere. Priority and status are plain text.
- Consistent column widths. No text wrapping mid-word.
- Use shared pdf-kit.ts helpers. Never bespoke inline PDF implementations.
- Cover for Coordination Report, Audit Certificate, Dispute Report, Tracking Reports.
- Branded running header for RFI Log, Submittal Log, Change Order Log, Transmittal Log.
- Lens Viewpoints reports default to active/current rows unless explicitly configured otherwise.
- Revision/history appendix must be scoped to the report's own chains, never the whole project.

### Platform UI
- Consistent column widths in all tables. No text wrapping mid-word.
- Consistent header style across all modules.
- Consistent action button placement per row.
- Consistent status labels platform-wide.
- Consistent empty states for every table.
- Consistent error messages. Never show raw database errors to users.
- Lifecycle/chain attributes get their own columns with show/hide toggles.
- Use "State" for user-facing lifecycle column language unless developer context requires lifecycle.
- User guidance should be easy to turn on/off and should explain the correct workflow without
  blocking expert users.

### Excel exports
- Branded header row with BIMLog by IgniteSmart and project name.
- Consistent column structure per module.
- No raw database field names as column headers.
- Auto-sized columns. No truncated content.
- Respect the same filters/scope as the live table and PDF.
- Exports must be professional enough to send to a client without manual cleanup.

### Terminology
- Priority labels: P1 Critical, P2 High, P3 Medium, P4 Low, P5 Monitor.
- Status labels: Open, Follow Up, Waiting Design, Approved, Resolved.
- Never use database field names in UI or reports.

## Current product direction
- BIMLog must become easier than a spreadsheet plus a folder full of PDFs, while keeping BIM,
  Navisworks, reporting, and AI coordination intelligence connected.
- Submittals should feel like one integrated module with views: Submittals, Register, Tracking
  Table. Tracker is a live view/report, not a separate product concept.
- Schedule should be a coordination schedule: RFI dates, submittal dates, manual milestones,
  calendar view, board view, list view, and clear editing.
- AI should assist without surprising users with cost. Cheap text assist and expensive file reading
  are separate actions.
- Platform should move toward structured data that supports decisions, not just stored documents.
