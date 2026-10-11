# Launch Readiness Block 22 — LR106–LR110

LR106 independently hashes the received export bytes in the browser and rejects any mismatch. LR107 binds and enforces the exact response length with a one MiB maximum. LR108 parses the downloaded JSON only after digest verification and requires the canonical schema, request identity, export kind and fulfilled state. LR109 shows a bilingual verified-download status with a short customer-safe digest reference. LR110 binds these behaviors into permanent acceptance.

Together with LR101–LR105, this is the next ten-build publication candidate. No deletion, correction or restriction is automated, and no second support authority is introduced.
