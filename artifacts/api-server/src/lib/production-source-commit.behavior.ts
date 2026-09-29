import assert from "node:assert/strict";
import { resolveProductionSourceCommit } from "./production-source-commit";

const head = "a".repeat(40);
const remote = "b".repeat(40);
const tree = "c".repeat(40);

assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, replitEnvironment: false }), head);
assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, headSubject: "Published your App", parentCommit: remote, parentTree: tree, replitEnvironment: false }), remote);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, headSubject: "Published your App", parentCommit: remote, parentTree: "d".repeat(40), replitEnvironment: false }), /changes/);
assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: true, replitEnvironment: true }), remote);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: "d".repeat(40), remoteMasterIsAncestor: true, replitEnvironment: true }), /differs/);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: false, replitEnvironment: true }), /not descended/);

console.log("production source commit behavior: PASS");
