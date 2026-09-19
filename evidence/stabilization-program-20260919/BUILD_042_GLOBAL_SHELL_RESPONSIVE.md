# Build 042 — Global shell responsive continuity

- Result: PASS
- Scope: headquarters sidebar, resize/collapse persistence, notification drawer, mobile navigation and content offsets.
- Correction: the mobile breakpoint is now correct on first render; the off-canvas navigation is inert while closed, exposes modal semantics while open, receives focus, closes with Escape or route navigation, restores trigger focus, and prevents background scrolling.
- Verification: `node artifacts/bimlog/src/components/layout/GlobalShellResponsive.behavior.ts`; BIMLog TypeScript check.
- Desktop and exact-390 contract: PASS by source/CSS behavior assertions; final rendered comparison remains Build 045.
- Native/installer impact: none.
