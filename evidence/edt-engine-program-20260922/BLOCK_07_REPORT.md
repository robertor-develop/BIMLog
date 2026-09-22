# EDT and Engine Templates — Block 7 corrective source

Builds 306–310, 2026-09-22. This block corrected real integrity defects in the prior EDT service foundation. It did **not** enable the guarded activation, Economic Plan or time-mutation HTTP routes, or deliver the planned UI/runtime integration.

- 306 `01bc3daace86ea2039144e490073a173a66f0dd4`: Work Item tenant queries join the canonical Intake because Work Items have no company column.
- 307 `7c4aa46b0580803703815f7d018c55d8626d319e`: unsupported governed actions cannot be approved into a false audit decision.
- 308 `653240b146fe25b52d6bb87c74b3c42db2fa3ddb`: activation approval rechecks the saved Intake revision and state under lock.
- 309 `3993c9239c6b44a4882a64eb2031597a3aa2fd5f`: time-ledger budget account is checked against the same Intake, project and company before mutation.
- 310 `495607589c608eb96af2749a479a9137a048ba0b`: incomplete/ambiguous EDT plans and Work Items outside the Intake cannot be approved.

Focused regression: `pnpm run test:edt-engine-block07`. API typecheck and full pre-push release gate must pass before push. No database schema or production data mutation. No Native/installer delta; focused Navisworks smoke not applicable. Publication and authenticated Chrome smoke are scheduled after the following five-build block.

Remaining product requirement: server-derived version binding, generated EDT plan, canonical economic and time amounts, and real Intake/Operations UI must be implemented and tested before guarded routes are enabled. The existing canonical Intake/Operations journeys remain in service.
