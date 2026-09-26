# I004 — duplicate prevention without name-based membership

Public registration no longer attaches an uninvited registrant to an existing company by name. Company creation serializes collision checks; readable joining guidance handles a conflict. A database trigger protects all insert/name-update paths, including administrative/directory writers, against punctuation/case/spacing/NFKC collisions without rewriting existing records. Similarity never grants access. Distinct new companies remain creatable; unresolved real same-name organizations require administrator identity resolution.

Actual PostgreSQL checks passed for punctuation, case, whitespace, full-width Unicode, renaming collision and two-connection concurrent insertion. One competing create succeeds and the duplicate is refused. A distinct new owner remains allowed. Alias and reconciliation regressions pass. Full application/publication gates remain pending.

Legacy email-bound pending invitation acceptance is NOT represented as secure token acceptance: that is explicit I006–I010 work. No production registration/data/schema was changed by this local build.
