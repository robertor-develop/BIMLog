---
name: api-client-react declaration rebuild
description: Why editing the generated api-client source isn't enough for bimlog, and how to make consumers see new types
---

# bimlog reads api-client-react via project references (dist .d.ts)

`artifacts/bimlog/tsconfig.json` lists `references: [{ path: "../../lib/api-client-react" }]`.
With TS project references, bimlog type-checks against the **compiled** `lib/api-client-react/dist/**/*.d.ts`, NOT the `src` that the package's `exports` map points to. So editing `lib/api-client-react/src/generated/api.schemas.ts` alone does nothing for bimlog — it still sees the stale `dist` declaration and reports "property does not exist on type Rfi".

**Fix:** after editing the generated client source, rebuild its declarations:
`pnpm exec tsc -b lib/api-client-react --force`
(The package is `composite: true`, `emitDeclarationOnly`, `outDir: dist`. There is NO `build` npm script, so you must invoke `tsc -b` directly.)

**Why:** the symptom is misleading — the edit is correct but invisible. Cost real time chasing "wrong Rfi resolution" before realizing it was the dist .d.ts.

**How to apply:** any time you hand-edit `lib/api-client-react/src/generated/*` (e.g. adding fields without running orval — codegen is unsafe here, see spec drift), follow with `tsc -b lib/api-client-react --force`, then re-run the bimlog typecheck.
