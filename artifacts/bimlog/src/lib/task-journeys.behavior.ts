import assert from "node:assert/strict";
import fs from "node:fs";
import { TASK_JOURNEYS, journeyDestination, journeySelection, projectContext } from "./task-journeys";
import { HELP_TOPICS } from "./help-content";
assert.equal(TASK_JOURNEYS.length, 4);
assert.equal(new Set(TASK_JOURNEYS.map(j => j.id)).size, 4);
for (const from of ["", "//evil.test/projects/26", "/projects/0/intake", "/projects/26x/intake", "/projects/26/../27", "/projects/26\\evil", "/projects/9007199254740992/intake", "/projects/%32%36/intake", "https://example.com/projects/26"]) {
  assert.equal(projectContext(from), null, from);
  assert.equal(journeyDestination(from, "intake"), "/dashboard");
}
assert.equal(projectContext("/projects/26/intake?step=scope"), "26");
assert.equal(journeyDestination("/projects/26/intake", "//evil.test"), "/dashboard");
for (const journey of TASK_JOURNEYS) {
  for (const [index, step] of journey.steps.entries()) {
    assert(HELP_TOPICS.some(t => t.id === step.topic), `Missing manual topic: ${step.topic}`);
    const expected = step.destination === "convention"
      ? "/projects/26/convention?returnTo=%2Fprojects%2F26%2Fintake"
      : `/projects/26/${step.destination}`;
    assert.equal(journeyDestination("/projects/26/intake", step.destination), expected);
    const selected = journeySelection(`?journey=${journey.id}&step=${index}`);
    assert.equal(selected.journey.id, journey.id); assert.equal(selected.index, index);
    for (const value of [step.title, step.action, step.completion, step.recovery]) assert(value.en.trim() && value.es.trim());
  }
}
for (const value of ["-1", "1.5", "Infinity", "99999999999999999999", "oops", "4"]) assert.equal(journeySelection(`?journey=setup&step=${value}`).index, 0);
assert.equal(journeySelection("?journey=unknown&step=0").journey.id, "setup");
assert.deepEqual(TASK_JOURNEYS[0].steps.map(s => s.destination), ["intake", "convention", "intake", "operations"]);
const routes = JSON.parse(fs.readFileSync(new URL("../../../../docs/experience/ux-program/ROUTES.json", import.meta.url), "utf8"));
for (const journey of TASK_JOURNEYS) for (const step of journey.steps) assert(routes.routes.some((r: { route: string }) => r.route === `/projects/:id/${step.destination}`), `Unknown destination ${step.destination}`);
console.log("UX001–UX005 behavior: four journeys, exact project destinations, bilingual recovery, missing/hostile context and reload state PASS.");
