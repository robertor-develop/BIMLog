# Build 214 — Provider interruption and retry

Status: PASS

- Provider interruption before promotion may retry only the same exact candidate within the bounded attempt limit.
- Candidate identity changes, exhausted attempts, an observed promotion, or any interruption during/after Promote stop fail closed.
- Retry tokens bind the exact candidate and attempt number; the test never treats an ambiguous provider state as safe to replay.
