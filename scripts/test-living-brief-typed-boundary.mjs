import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../artifacts/api-server/src/lib/living-brief-source.ts", import.meta.url), "utf8");

assert.doesNotMatch(source, /@ts-ignore|@ts-expect-error/);
assert.match(source, /declare const __dirname: string \| undefined;/);
assert.match(source, /typeof __dirname !== "undefined"/);
assert.match(source, /if \(import\.meta\.url\) return path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/);
assert.match(source, /catch \{ \/\* CommonJS runtime \*\/ \}/);

console.log("LIVING_BRIEF_TYPED_BOUNDARY=PASS commonjs=typed esm=typed suppressions=0");
