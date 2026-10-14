import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("./ConventionBuilder.tsx", import.meta.url)),
  "utf8",
);
const navigation = readFileSync(
  fileURLToPath(new URL("./convention-builder/convention-navigation.ts", import.meta.url)),
  "utf8",
);

const componentStart = source.indexOf("export function ConventionBuilder(");
const loadingReturn = source.indexOf("if (isLoading) return", componentStart);
const guardComment = source.indexOf("Keep this hook above every loading/error return", componentStart);
const guardCall = source.indexOf("useConventionPhaseGuard(", guardComment);

assert.ok(componentStart >= 0, "ConventionBuilder component must exist");
assert.ok(loadingReturn > componentStart, "ConventionBuilder loading return must exist");
assert.ok(guardComment > componentStart, "hook-order guard explanation must remain in ConventionBuilder");
assert.ok(guardCall > guardComment, "phase guard must remain called before early returns");
assert.ok(
  guardCall < loadingReturn,
  "every ConventionBuilder hook must execute before the loading return to preserve React hook order",
);
assert.match(navigation, /useEffect\(\(\) => \{/);
assert.match(navigation, /guardedConventionPhase\(setupStatus, flowPhase\)/);

console.log("ConventionBuilder hook-order behavior: PASS");
