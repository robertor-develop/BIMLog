# Build 053 — APU allocation reconciliation

- Commercial totals flow into direct-production phases in integer minor units.
- Phase percentages must total exactly 100%; phase identities are stable and unique.
- Largest-remainder distribution is deterministic and preserves the exact approved total.
- The golden scenario reconciles APU base, overhead, contingency, tax, phase lines, and roll-up total without floating-point drift.
- Native/installer impact: none.
