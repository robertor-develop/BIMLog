import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("artifacts/api-server/src/index.ts", "utf8");
const build = readFileSync("artifacts/api-server/build.ts", "utf8");

assert.match(source, /process\.env\.NODE_ENV === "development" \? "\.\/app\.ts" : "\.\/app\.mjs"/);
assert.match(source, /createApplicationBootstrap\(\(\) => import\(applicationBundle\)\)/);
assert.match(build, /outfile: path\.resolve\(distDir, "app\.mjs"\)/);
assert.match(build, /outfile: path\.resolve\(distDir, "index\.cjs"\)/);
console.log("API development and production bootstrap targets: PASS");
