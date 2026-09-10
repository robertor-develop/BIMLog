import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const landing = readFileSync(new URL("./pages/Landing.tsx", import.meta.url), "utf8");

assert.equal(
  landing.match(/bg-primary\/8 border border-primary\/20 text-blue-700/g)?.length,
  2,
  "both blue tinted badges use the verified stronger foreground",
);
assert.doesNotMatch(
  landing,
  /color: "hsl\(var\(--muted-foreground\)\)", opacity: 0\.4/,
  "workflow step numbers are not faded below text contrast requirements",
);
assert.match(
  landing,
  /className="text-red-700 font-semibold mb-3"/,
  "validation example heading uses the verified stronger red foreground",
);
assert.match(
  landing,
  /className="text-red-700">\{e\.field\}<\/span>/,
  "validation example field labels use the verified stronger red foreground",
);
assert.doesNotMatch(
  landing,
  /text-destructive(?: font-semibold)?[^\n]*(?:Naming Violation|\{e\.field\})/,
  "the previously failing destructive foreground is absent from validation text",
);

console.log("SUMMARY 5/5 PASS");
