import assert from "node:assert/strict";import {parseSupportResolution} from "./support-case-resolution";
assert.equal(parseSupportResolution("  Customer access restored after membership refresh.  "),"Customer access restored after membership refresh.");for(const value of [null,"short","api_key=abc123456789","x".repeat(2001)])assert.throws(()=>parseSupportResolution(value));
console.log("B186 bounded secret-safe support resolution: PASS");
