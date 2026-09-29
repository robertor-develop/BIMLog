import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../pages/Features.tsx", import.meta.url), "utf8");
assert.equal((source.match(/role: \[/g) ?? []).length, 4);
for (const marker of ["availability:", "prerequisite:", "/help?topic=job-intake", "/help?topic=job-operations"]) assert.match(source, new RegExp(marker.replace("?", "\\?")));
console.log("features presentation behavior: PASS");
