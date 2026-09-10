import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./pages/AdminPanel.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("./pages/Login.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const footer = readFileSync(new URL("./components/layout/Footer.tsx", import.meta.url), "utf8");

const checks = [
  ["admin modal fits an exact 390px viewport", /padding: 12[\s\S]*minWidth: 0[\s\S]*width: "min\(100%, 560px\)"/.test(source)],
  ["admin modal exposes dialog semantics", /role="dialog" aria-modal="true" aria-label=\{title\} tabIndex=\{-1\}/.test(source)],
  ["admin modal receives initial keyboard focus", /dialogRef\.current\?\.focus\(\)/.test(source)],
  ["Escape closes the admin modal", /event\.key === "Escape"/.test(source)],
  ["closing the admin modal restores opener focus", /openerRef\.current\?\.focus\(\)/.test(source)],
  ["admin modal close control has a bilingual accessible name", /aria-label=\{isSpanishUi\(\) \? "Cerrar diálogo" : "Close dialog"\}/.test(source)],
  ["mobile viewport preserves user zoom", !html.includes("maximum-scale") && html.includes('content="width=device-width, initial-scale=1.0"')],
  ["default muted text meets the audited contrast correction", css.includes("--muted-foreground: 220 10% 43%;")],
  ["password visibility control remains keyboard reachable", !/tabIndex=\{-1\}[\s\S]{0,120}aria-label=\{showPassword/.test(login)],
  ["password visibility control has a sufficient touch target", /padding: 8, width: 32, height: 32/.test(login)],
  ["password recovery link has a sufficient touch target", login.includes("inline-flex min-h-6 items-center text-xs")],
  ["public footer collapses to one column at 390px", /@media\(max-width:390px\)[\s\S]*\.public-footer-grid\{grid-template-columns:minmax\(0,1fr\)!important\}/.test(footer)],
  ["public footer metadata stacks without clipping", footer.includes(".public-footer-meta{align-items:flex-start!important;flex-direction:column}")],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, name);
  console.log(`PASS ${name}`);
}
console.log(`SUMMARY ${checks.length}/${checks.length} PASS`);
