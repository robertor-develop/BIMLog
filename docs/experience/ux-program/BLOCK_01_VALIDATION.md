# UX001–UX005 validation

- Source route inventory: 61 route/tab bindings, four explicit unavailable capability groups; deterministic drift check passes.
- Behavior tests: four bilingual journeys, exact same-project links, existing manual topics, invalid/missing context fallback, bounded persisted step selection and setup/prerequisite/return/task sequence pass.
- Frontend typecheck: passed before browser verification; full gate repeats it on the final source.
- Chrome component verification: actual production TaskJourneyGuide imported by the local harness; desktop English and mobile English/Spanish at observed 390 CSS pixels. All four goals inspected, naming step survives reload, Intake/Operations destinations checked, browser return retains selection, Enter activates step buttons, missing project offers Dashboard recovery. No horizontal overflow at 390px (document width 373px including scrollbar space). Visual inspection passed.
- Design correction during review: removed the setup-only Intake return from coordinator/operator/administrator journeys. Recovery copy no longer refers to a missing link when project context is absent.
- Tooling recovery: use the existing F:/BIMLog/TestProof/identity-run-clean-env.cjs wrapper to remove duplicate PATH/Path entries when invoking pnpm on Windows. No dependency or global configuration change.
- The generated PLATFORM.md initially overwrote a narrative addition; the authoritative generator was updated and the source seal regenerated. No integrity gate was relaxed.

This is local component verification, not authenticated production acceptance, project persistence proof or provider delivery proof. The usability baseline remains unmeasured.

The clean-commit full gate is run after this evidence is committed. Its final outcome and exact SHA are recorded externally at F:/BIMLog/Evidence/ux-audit-20260928/UX-B01-release-gate.json and UX-B01-release-gate.log; absence of a PASS receipt means the block is not push-ready. The final response reports verified push status. Publication is due at UX010, not this five-build boundary.
