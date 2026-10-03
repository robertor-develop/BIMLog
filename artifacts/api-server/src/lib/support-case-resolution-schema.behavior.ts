import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const schema=readFileSync(fileURLToPath(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url)),"utf8"),app=readFileSync(fileURLToPath(new URL("../app.ts",import.meta.url)),"utf8");for(const source of [schema,app])for(const token of ["resolution_summary","resolved_by_user_id","resolved_at"])assert.ok(source.includes(token),token);
console.log("B187 durable support resolution schema parity: PASS");
