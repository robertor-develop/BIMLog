# UX Block 26 validation — member internal cost and CEO approval

UX126–UX130 replace editable capacity-profile cost hints with versioned company policy and approved member-cost authority.

- Company policy versions preserve role rates, effective date, proposer, CEO decision, supersession, and fingerprint. The BIMTech inputs are recorded through policy data; they are not platform constants.
- Member profile versions inherit the selected approved policy rate for the member's cost role. Missing approved profiles produce an explicit unresolved state and block priced assignment.
- Only CEO authority can approve or reject policy/profile proposals. Ordinary Job Intake cannot write these rates.
- Operations shows the applicable approved source only to budget-authorized users.
- A named assignment snapshots the exact policy/profile version, rate, and effective date. Time cost continues to use that stored assignment rate, so later policy changes cannot silently reprice history. Customer/non-budget responses redact internal rates, costs, and source-version identities.

Focused acceptance covers rate validation, unresolved member lookup, approval authority, bilingual governance presentation, redaction, immutable snapshot identity, and separation from customer billing rates. UX121–UX130 now reach the required ten-build publication boundary.
