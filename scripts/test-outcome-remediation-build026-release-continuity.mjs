import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const branch = git("branch", "--show-current");
const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
assert.equal(upstream, `origin/${branch}`, "release branch must retain its matching upstream");
assert.equal(git("rev-parse", "HEAD"), git("rev-parse", "@{upstream}"), "Build 26 starts from the exact pushed source");
console.log("OUTCOME-B026 PASS: release continuity is exact; infrastructure only, no feature-completion credit");
