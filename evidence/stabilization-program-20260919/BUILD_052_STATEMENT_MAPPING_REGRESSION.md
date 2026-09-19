# Build 052 — Statement monetary-column regression

- Quantity, unit-rate, and stated-total columns are explicit and must be distinct.
- Every imported statement row proves `quantity × unit rate = stated total` under the Build 051 exact-money rules.
- The historical defect vector that treated the `$480,000` whole-plan total as the unit rate now fails with `FINANCIAL_STATEMENT_TOTAL_MISMATCH`.
- Historical evidence is unchanged; this is a permanent forward regression.
- Native/installer impact: none.
