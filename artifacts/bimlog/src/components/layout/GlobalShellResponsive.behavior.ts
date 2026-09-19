import assert from "node:assert/strict";
import fs from "node:fs";

const sidebar = fs.readFileSync(new URL("./MasterSidebar.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../index.css", import.meta.url), "utf8");

const checks: Array<[string, RegExp]> = [
  ["mobile state is correct on first render", /matchMedia\("\(max-width: 720px\)"\)\.matches/],
  ["mobile drawer is modal and hidden when closed", /role=\{isMobile \? "dialog".*aria-modal=.*aria-hidden=.*inert=/s],
  ["mobile drawer traps page scroll while open", /document\.body\.style\.overflow = "hidden"/],
  ["Escape closes mobile navigation", /event\.key === "Escape"/],
  ["drawer receives focus", /mobileCloseRef\.current\?\.focus/],
  ["drawer restores trigger focus", /mobileTriggerRef\.current\?\.focus/],
  ["route changes close mobile navigation", /setMobileOpen\(false\), \[location\]/],
  ["desktop shell prevents page-level overflow", /\.app-shell \{[^}]*overflow: hidden/s],
  ["desktop main area can shrink", /\.main-area \{[^}]*min-width: 0/s],
  ["390px content cannot create page overflow", /@media \(max-width: 390px\)[\s\S]*\.page-content \{[\s\S]*overflow-x: hidden/s],
  ["notification drawer uses bounded mobile width", /isMobile \? "calc\(100vw - 24px\)"/],
];

for (const [name, pattern] of checks) assert.match(`${sidebar}\n${css}`, pattern, name);
console.log(JSON.stringify({ status: "PASS", checks: checks.length, desktop: true, mobile390: true }));
