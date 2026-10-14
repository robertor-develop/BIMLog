import assert from "node:assert/strict";
import fs from "node:fs";

const master = fs.readFileSync(new URL("../artifacts/bimlog/src/components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
const project = fs.readFileSync(new URL("../artifacts/bimlog/src/components/layout/ProjectSidebar.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../artifacts/bimlog/src/index.css", import.meta.url), "utf8");

const checks = [
  ["headquarters drawer is a bounded modal region", master, /ref=\{mobilePanelRef\}.*role=\{isMobile \? "dialog".*aria-modal=\{isMobile \? true/s],
  ["headquarters drawer traps tab focus", master, /event\.key !== "Tab".*querySelectorAll<HTMLElement>.*event\.shiftKey.*last\.focus\(\).*first\.focus\(\)/s],
  ["headquarters drawer restores trigger focus and body scrolling", master, /closeMobileNavigation.*mobileTriggerRef\.current\?\.focus\(\).*document\.body\.style\.overflow = "hidden".*document\.body\.style\.overflow = previousOverflow/s],
  ["project drawer declares modal semantics", project, /ref=\{mobilePanelRef\}.*role="dialog".*aria-modal="true".*Project navigation/s],
  ["project drawer traps tab focus", project, /event\.key !== "Tab".*querySelectorAll<HTMLElement>.*event\.shiftKey.*last\.focus\(\).*first\.focus\(\)/s],
  ["project drawer restores trigger focus and body scrolling", project, /document\.body\.style\.overflow = "hidden".*document\.body\.style\.overflow = previousOverflow.*const closeMobile.*mobileTriggerRef\.current\?\.focus\(\)/s],
  ["mobile project groups use their real disclosure state", project, /const isOpen = !!expandedGroups\[group\.id\].*onClick=\{\(\) => toggleGroup\(group\.id\)\}/s],
  ["the active project group cannot hide its active destination", project, /\[id\]: id === activeGroup \? true : !prev\[id\]/],
  ["project disclosure state is bounded and persistent", project, /bimlog-project-navigation-groups.*Object\.fromEntries\(navGroups\.map.*JSON\.stringify\(bounded\)/s],
  ["project drawer remains within narrow viewport width", styles, /\.phasea-mobile-nav-panel\s*\{[^}]*width: min\(340px, 88vw\)/s],
  ["mobile navigation controls meet touch target minimum", styles, /\.phasea-mobile-nav-panel \.phasea-nav-group-trigger,[\s\S]*min-height: 44px/],
];

for (const [name, source, pattern] of checks) assert.match(source, pattern, name);
assert.doesNotMatch(styles, /\.phasea-nav-mobile-list \.phasea-nav-group-body\s*\{[^}]*display:\s*block/s, "mobile CSS must not force closed groups open");
console.log(`Responsive navigation assertions: ${checks.length + 1}/${checks.length + 1} passed`);
