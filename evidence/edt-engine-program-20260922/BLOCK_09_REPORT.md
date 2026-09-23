# EDT Engine Block 9 — Builds 316–320

Builds 316–320 tighten the server-side EDT approval contract without opening the four guarded mutation routes:

- 316 `a391ceecf98f3ba9cb18d22f8a160e5a9a262369`: Work Items attach only to their own location leaf.
- 317 `6a651f8f73437ead079d5b964bcc00bf12884c3d`: location, deliverable and Contract ancestry must agree with Work Item identities.
- 318 `f513d987a417f3226029c14e0612c76194aea054`: visible Work Item codes are deterministic from immutable project, Contract, deliverable, location and trade identities; arbitrary codes are rejected.
- 319 `03efb23b61abb71fc4298aef1f9cf979a1f72538`: approval locks and covers every saved active Intake Work Item exactly once.
- 320 `936e86ec5ca26837a5243fad7d441542b89feb1a`: each planned item remains bound to its saved canonical Contract and stable scope item.

Focused Block 9 behavior checks and API typecheck passed. Earlier Build 308/310 fixtures were updated to the stronger plan contract and passed. Full pre-push gate, exact-head push and remote comparison remain separate release checks. No production data or schema changed in this block. No Lens Next Native or installer changed, so focused Navisworks smoke is not applicable. Next publication is due after Build 325, not after this push-only block.

Remaining product gap: versions, EDT nodes and Work Items must be generated entirely from saved Intake, Contract, APU, Delivery Workflow and Governance records; economic and time amounts must be server-derived. The guarded HTTP mutation routes remain intentionally closed. This block is not an end-to-end EDT activation acceptance claim.
