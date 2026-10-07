import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { journeyDestination, safeHelpResumeTarget } from "./task-journeys";

const from = "/projects/63/intake?stage=delivery&item=ji-email-readiness";
const help = "/help?view=guides&journey=setup&step=1&from=%2Fprojects%2F63%2Fintake%3Fstage%3Ddelivery%26item%3Dji-email-readiness";
assert.equal(safeHelpResumeTarget(help, 63), help);

for (const destination of ["intake", "operations", "files", "submittals", "team", "integrations"]) {
  const launched = new URL(journeyDestination(from, destination, help), "https://bimlog.app");
  assert.equal(launched.searchParams.get("helpReturn"), help);
  assert.equal(safeHelpResumeTarget(launched.searchParams.get("helpReturn"), 63), help);
}

const guide = readFileSync(new URL("../components/TaskJourneyGuide.tsx", import.meta.url), "utf8");
const project = readFileSync(new URL("../pages/ProjectDetail.tsx", import.meta.url), "utf8");
const helpCenter = readFileSync(new URL("../pages/HelpCenter.tsx", import.meta.url), "utf8");
assert.match(guide, /journeyDestination\(from, step\.destination, helpResume\)/);
assert.match(project, /<HelpReturnBanner projectId=\{projectId\} \/>/);
assert.match(helpCenter, /This returns to the exact page where you opened Help\./);
assert.match(helpCenter, /Esto regresa a la página exacta donde abrió Ayuda\./);

console.log("Human flow continuity block 5: Help-to-workspace round trips PASS");
