import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const pageModules = [...app.matchAll(/namedPage\(\(\) => import\("(@\/pages\/[^\"]+|@\/features\/lens-next\/LensNextWorkspace)"\)/g)].map(match => match[1]);

assert.ok(app.includes("lazy, Suspense"), "React lazy loading and Suspense are enabled");
assert.ok(pageModules.length >= 28, `expected routed modules to be lazy, found ${pageModules.length}`);
assert.equal(new Set(pageModules).size, pageModules.length, "each routed module has one lazy boundary");
assert.match(app, /<Suspense fallback=\{<div className="route-loading" role="status" aria-live="polite">/);
assert.doesNotMatch(app, /^import \{ (Landing|Dashboard|ProjectDetail|JobIntakeWorkspace) \}/m);

console.log(`PASS ${pageModules.length} routed modules use lazy imports`);
console.log("PASS route loading state is announced accessibly");
console.log("PASS eager routed page imports are absent");
console.log("SUMMARY 3/3 PASS");
