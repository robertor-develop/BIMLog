# Build 093 — AI draft authority

- AI output authority is fixed at `draft_only` and `authoritative: false`.
- Decision receipts bind actor, project, feature, source digest, original draft digest, final draft digest, and accepted/edited/rejected outcome.
- Edited output must differ, accepted output must match the reviewed draft, and rejected output cannot carry final text.
- The existing RFI surface remains editable and explicitly says `AI draft ready — review before saving`; saving and workflow mutation remain separate authenticated actions.
