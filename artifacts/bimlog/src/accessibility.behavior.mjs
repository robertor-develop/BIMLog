import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("./components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

const checks = [
  ["skip link targets the primary content", app.includes('className="skip-to-main" href="#main-content"')],
  ["primary content is programmatically focusable", app.includes('id="main-content" tabIndex={-1}')],
  ["skip link becomes visible on focus", /\.skip-to-main:focus\s*\{[^}]*translateY\(0\)/s.test(css)],
  ["interactive controls share a visible keyboard focus ring", /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible/s.test(css)],
  ["reduced-motion preference disables nonessential movement", /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*0\.01ms[\s\S]*transition-duration:\s*0\.01ms/s.test(css)],
  ["sidebar resize advertises keyboard shortcuts", sidebar.includes('aria-keyshortcuts="ArrowLeft ArrowRight Home End"')],
  ["sidebar resize supports arrow keys", sidebar.includes('event.key === "ArrowLeft"') && sidebar.includes('event.key === "ArrowRight"')],
  ["sidebar resize supports exact minimum and maximum", sidebar.includes('event.key === "Home"') && sidebar.includes('event.key === "End"')],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, name);
  console.log(`PASS ${name}`);
}
console.log(`SUMMARY ${checks.length}/${checks.length} PASS`);
