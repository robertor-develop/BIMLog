import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative: string) => fs.readFileSync(new URL(`../routes/${relative}`, import.meta.url), "utf8");
const activity = read("activity.ts");
const coordinator = read("coordinator-actions.ts");

for (const [name, source] of [["activity", activity], ["coordinator", coordinator]] as const) {
  assert.match(source, /applyPdfDownloadHeaders\(res, \{ fileName:/u, `${name} must use the shared safe PDF delivery contract`);
  assert.doesNotMatch(
    source,
    /setHeader\("Content-Type", "application\/pdf"\)[\s\S]{0,160}setHeader\("Content-Disposition"/u,
    `${name} must not retain the bespoke paired PDF headers`,
  );
}

assert.match(activity, /const filename = `Activity-Log-/u);
assert.match(coordinator, /const filename = `Coordinator-Command-Center-/u);
assert.match(coordinator, /X-BIMLog-Content-SHA256/u);
assert.match(activity, /Registro de Actividad/u);
assert.match(coordinator, /Centro de Control de Coordinación/u);

console.log("POST120_BUILD138=PASS activity coordinator project-insights shared-delivery rendered-content-unchanged");
