import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const branch = git("branch", "--show-current");
const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
assert.equal(upstream, `origin/${branch}`, "release branch must retain its matching upstream");
assert.equal(git("merge-base", "HEAD", "@{upstream}"), git("rev-parse", "@{upstream}"), "the pushed source must be the exact candidate ancestor");
const [behind, ahead] = git("rev-list", "--left-right", "--count", "@{upstream}...HEAD").split(/\s+/).map(Number);
assert.equal(behind, 0, "the publication candidate cannot be behind its upstream");
console.log(`OUTCOME-B026 PASS: release continuity is exact with ${ahead} reviewed commit(s) pending; infrastructure only, no feature-completion credit`);
