import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./MasterSidebar.tsx", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["daily navigation is explicitly identified", /Daily work.*Trabajo diario/],
  ["daily navigation preserves the approved order", /Home.*Intake.*Operations.*Documents.*Coordination.*Reports/s],
  ["project destinations use the authorized active project", /activeProjects\[0\].*projectDailyNavButton.*`\/projects\/\$\{activeProjectId\}\/\$\{destination\}`/s],
  ["intake destination remains exact", /projectDailyNavButton\(t\("Intake".*"intake"/s],
  ["operations destination remains exact", /projectDailyNavButton\(t\("Operations".*"operations"/s],
  ["documents destination remains the files workspace", /projectDailyNavButton\(t\("Documents".*"files"/s],
  ["coordination destination remains exact", /projectDailyNavButton\(t\("Coordination".*"coordination"/s],
  ["reports destination remains exact", /projectDailyNavButton\(t\("Reports".*"reports"/s],
  ["missing project access stays visible but unavailable", /requires an active project assignment[\s\S]*aria-disabled=\{!route\}/],
  ["full capability directory remains visible", /Full capability directory.*All Tools/s],
  ["administration remains present", /Administration.*Project Administration.*Company Catalogs/s],
  ["settings remain present", /Settings.*Notification Settings.*Billing & Support/s],
];

for (const [name, pattern] of checks) assert.match(source, pattern, name);
console.log(`PRIMARY_DAILY_NAVIGATION_P011=PASS checks=${checks.length}`);
