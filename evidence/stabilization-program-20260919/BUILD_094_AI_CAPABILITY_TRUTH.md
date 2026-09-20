# Build 094 — AI capability truth

- The dashboard now says `Project briefing`, not `AI Briefing`, because the result is deterministic and no external request occurs.
- The UI discloses `No external AI request` and identifies incomplete-data fallback truthfully.
- `concierge.click_driven` and `concierge.intelligence` remain `coming_later`; isolated controls are not presented as a complete Concierge product.
- A source-level behavior gate prevents the removed silent briefing call or overstated labels from returning unnoticed.
