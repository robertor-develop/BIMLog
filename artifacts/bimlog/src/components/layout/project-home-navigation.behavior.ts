import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sidebar = readFileSync(new URL("./ProjectSidebar.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../../pages/ProjectDetail.tsx", import.meta.url), "utf8");
assert.match(sidebar, /id: "home"[\s\S]*labelEn: "Project Home"[\s\S]*href: `\/projects\/\$\{projectId\}`/);
assert.match(detail, /const tab = params\?\.tab === "dashboard" \? "analytics" : params\?\.tab \|\| "home"/);
assert.match(detail, /tab === "home" && <ProjectHome/);
console.log("PROJECT_HOME_NAVIGATION_RESULT=PASS project root renders a named home destination");
