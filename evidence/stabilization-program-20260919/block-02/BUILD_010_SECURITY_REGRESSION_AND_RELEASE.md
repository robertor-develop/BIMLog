# Build 010 — security regression and release gate

Status: PASS_LOCAL_RELEASE_GATE

## Scope

- Close the production dependency-remediation block without weakening runtime closure, startup, database, secret, or Living Brief controls.
- Change no database/schema, customer data, Cloudflare configuration, Lens Next Native source, or installer.

## Corrections found by the real gate

- Replaced broad `form-data` and `uuid` resolutions with issuer-scoped advisory-path overrides.
- Bound the runtime assembler to three exact UUID issuer/spec/version contracts and retained generic out-of-range rejection.
- Reconciled the isolated closure fixture with the split `start.cjs` / `index.cjs` / `app.mjs` package.
- Prevented fixture-only package narrowing in the canonical production workspace.
- Corrected issuer identity parsing for peer-qualified and scoped pnpm lock keys.

## Exact local release evidence

- Dependency provenance: PASS (`pnpm@11.17.0` via exact `engines.pnpm`, provider-triggering `packageManager` absent, lockfile v9, 15 patched resolutions, 981 integrity-bound resolutions).
- Production audit: PASS, zero known vulnerabilities.
- Tracked-secret self-test and scan: PASS.
- Database safety: PASS (223 tables, 273 indexes, 184 startup tables reconciled).
- Artifact fixture: PASS against isolated loopback UTF-8 `bimlog_rfi_test` and private F-root custody.
- Mojibake and Living Brief integrity: PASS.
- Workspace type checks and production bundles: PASS.
- Runtime-closure regression: PASS, 18/18 cases; no package-manager or network install invoked.
- Deterministic production runtime closure: PASS, 15 direct packages, 15 transitive dependencies, 17,340 files.
- Isolated production artifact: API root 200, readiness 200, PDF/image/email/archive/DOCX/auth imports PASS.
- Invalid storage authority: natural exit 1 in 249.3 ms, no TCP listener, no readiness, port reusable.
- Valid isolated readiness: PASS (`readyMs=6586`, Windows x64).

The full clean-gate receipt above was produced by source commit `4472b222215cbb5f4d8173abcfa0a0b37e883d3f`. This evidence-only closeout is followed by an exact-head gate before push.

## Release boundary

Build 010 is the second five-build block and therefore requires normal push, Replit Shell publication without Replit Agents, and authenticated visible-Chrome production smoke under Roberto's standing authorization. Publication and live receipts are stored outside the immutable source candidate so the deployed source identity is not changed after verification.
