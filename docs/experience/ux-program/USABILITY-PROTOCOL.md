# UX004 — repeatable usability baseline

Baseline status: **not measured**. Previous audit observations establish defects, not representative timing or completion statistics. Do not invent a score or treat automated smoke as user research.

Run the same scenarios with coordinator, operator, manager and administrator accounts in approved fixtures, English and Spanish, desktop and 390px mobile. Role choice in the guide is an explanation, never a permission grant. Record browser, viewport, locale, build SHA and fixture label; exclude customer names, document text, email addresses, credentials and query strings.

| Scenario | Start → observable completion | Recovery fixture |
|---|---|---|
| S01 setup continuity | Saved draft → naming prerequisite → same Intake draft → first Operations task identified | Missing convention; reload/back; saved draft retained; no duplicate project |
| S02 commercial lineage | $30 selected APU/version → same unit/rate in Contract and EDT | Multiple APUs; wrong $35.47/$37.99 default; missing canonical version remains blocked with recovery |
| S03 future staffing | Seven-floor, 19-month scope → generic planned budget with future tasks unassigned | No employee exists for later floors; current failure is recorded until repaired |
| S04 drawing delivery | Identify drawing revision → correct review/dispatch record → actual outcome distinguishable | Missing email connection; no external send during smoke |
| S05 task execution | Locate assigned task → exact working revision → saved task update verified | Missing/denied record; filters; no replacement duplicate |
| S06 administrator | Find membership/integration settings → required readiness understood → return | Unauthorized role; no permission bypass; credential fields excluded from evidence |
| S07 help recovery | From a blocked task → relevant guide → correct source page → resume | Invalid link, missing project context, reload and language switch |

## Event definitions (protocol only; no telemetry collector enabled)

Allowed fields: scenario_id, attempt_id (random per test), role_class, locale, viewport_class, build_sha, event_name, elapsed_ms, outcome and reason_code from a fixed list. No user/project IDs, free text, URLs, keystrokes or screen contents in aggregate events.

- `scenario_started`: participant reads the goal; start monotonic clock.
- `step_reached`: intended source page and record context identifiable; not merely a click.
- `wrong_turn`: participant opens a destination that cannot advance the goal or must reconstruct context.
- `recovery_used`: participant resumes the same source after a blocked/missing/denied condition.
- `validation_error`: visible failed save/action; distinguish expected guard from defect.
- `scenario_completed`: observer verifies the stated outcome against source state; stop clock.
- `scenario_abandoned`: participant cannot proceed; preserve reason (navigation, missing_data, permission, rate_mismatch, unavailable, unknown).

Report completion rate with numerator/denominator and role breakdown; median successful elapsed time separately from abandon time; wrong turns and duplicate-entry attempts per scenario; recovery success / opportunities. No averaging unknowns into zeros. Compare before/after using the same fixtures and report sample size and limitations.

## Acceptance and review

Browser smoke must test real components, keyboard focus, responsive overflow, both languages and exact destinations. A component harness proves navigation guidance only, not backend save, activation, contract approval, provider delivery or production authentication. Full authenticated Chrome smoke is required after each ten-build publication. Any real failed test/production defect is repaired and rerun before proceeding.

UX005 is a working guidance prototype inside Help: setup → naming → return → Operations, with visible completion criteria and recovery. The prototype does not pretend to have saved an Intake. Known wrong turns remain documented until their implementation blocks fix the underlying pages.
