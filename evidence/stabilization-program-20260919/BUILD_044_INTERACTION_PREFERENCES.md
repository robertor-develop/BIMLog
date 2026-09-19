# Build 044 — Interaction and preference continuity

- Result: PASS
- Scope: ES/EN persistence, cross-tab language synchronization, theme persistence, cross-tab theme synchronization, reduced motion, keyboard focus, and shell touch targets.
- Corrections: theme state is established safely before interaction, storage failures no longer break the control, language/theme updates propagate between tabs, the language toggle names its destination bilingually, and changed mobile shell controls meet a 44px target.
- Verification: `GlobalInteraction.behavior.ts`, the existing global accessibility behavior suite, and BIMLog TypeScript check.
- Native/installer impact: none.
