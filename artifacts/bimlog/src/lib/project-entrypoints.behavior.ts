import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "../pages/JobIntakeWorkspace.tsx",
  "../pages/FinancialBudgetWorkspace.tsx",
  "../pages/Profile.tsx",
  "../pages/TotalControl.tsx",
  "../pages/AdminPanel.tsx",
  "../pages/Dashboard.tsx",
].map(path => readFileSync(new URL(path, import.meta.url), "utf8"));
for (const source of files) assert.doesNotMatch(source, /setLocation\(`\/projects\/\$\{[^}]+\}\/analytics`\)|navigate\(`\/projects\/\$\{[^}]+\}\/analytics`\)|href=\{`\/projects\/\$\{projectId\}\/analytics`\} className="fb-back"/);
assert.match(files[0], /href=\{`\/projects\/\$\{projectId\}`\}/);
assert.match(files[1], /href=\{`\/projects\/\$\{projectId\}`\} className="fb-back"/);
console.log("PROJECT_ENTRYPOINTS_RESULT=PASS project entry and back actions return to Project Home");
