import assert from "node:assert/strict";
import fs from "node:fs";

const i18n = fs.readFileSync(new URL("../../lib/i18n.tsx", import.meta.url), "utf8");
const navbar = fs.readFileSync(new URL("./Navbar.tsx", import.meta.url), "utf8");
const lang = fs.readFileSync(new URL("./LangToggle.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../index.css", import.meta.url), "utf8");

const checks: Array<[string, boolean]> = [
  ["language persists", i18n.includes("bimlog-lang") && i18n.includes("localStorage.setItem")],
  ["language synchronizes across tabs", i18n.includes("StorageEvent") && i18n.includes("setLangState(event.newValue)")],
  ["document language follows selection", i18n.includes("document.documentElement.lang = lang")],
  ["language control has bilingual destination", lang.includes("Switch language to Spanish") && lang.includes("Cambiar idioma a inglés")],
  ["theme initializes before paint state", navbar.includes("useState(() =>") && navbar.includes("prefers-color-scheme: dark")],
  ["theme persists safely", navbar.includes("localStorage.setItem(\"bimlog-theme\"") && navbar.includes("catch")],
  ["theme synchronizes across tabs", navbar.includes("event.key !== \"bimlog-theme\"")],
  ["theme touch target is 44px", navbar.includes("width: 44, height: 44")],
  ["reduced motion is global", /prefers-reduced-motion:\s*reduce[\s\S]*transition-duration:\s*0\.01ms/.test(css)],
  ["mobile shell controls meet 44px target", /@media \(max-width: 390px\)[\s\S]*\.sidebar-utility-button,[\s\S]*min-height: 44px/.test(css)],
  ["keyboard focus is visible", /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible/.test(css)],
];

for (const [name, passed] of checks) assert.equal(passed, true, name);
console.log(JSON.stringify({ status: "PASS", checks: checks.length, languages: ["en", "es"], theme: true, reducedMotion: true, touch: true }));
