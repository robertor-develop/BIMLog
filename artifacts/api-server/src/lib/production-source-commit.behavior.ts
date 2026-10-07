import assert from "node:assert/strict";
import { resolveProductionSourceCommit, selectUniqueRemoteTreeMatch, unwrapReplitPublishChain } from "./production-source-commit";

const head = "a".repeat(40);
const remote = "b".repeat(40);
const tree = "c".repeat(40);

assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, replitEnvironment: false }), head);
assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, headSubject: "Published your App", parentCommit: remote, parentTree: tree, replitEnvironment: false }), remote);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, headSubject: "Published your App", parentCommit: remote, parentTree: "d".repeat(40), replitEnvironment: false }), /changes/);
assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: true, replitEnvironment: true }), remote);
assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, headSubject: "Published your App", parentCommit: "d".repeat(40), parentTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: true, replitEnvironment: true }), remote);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: "d".repeat(40), remoteMasterIsAncestor: true, replitEnvironment: true }), /differs/);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: false, replitEnvironment: true }), /not descended/);
assert.equal(resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: true, acceptedCommit: remote, replitEnvironment: true }), remote);
assert.throws(() => resolveProductionSourceCommit({ headCommit: head, headTree: tree, remoteMasterCommit: remote, remoteMasterTree: tree, remoteMasterIsAncestor: true, acceptedCommit: "e".repeat(40), replitEnvironment: true }), /differs from the verified remote branch/);
assert.equal(unwrapReplitPublishChain([
  { commit: "d".repeat(40), tree, subject: "Published your App" },
  { commit: "e".repeat(40), tree, subject: "Published your App" },
  { commit: remote, tree, subject: "Canonical source" },
]).commit, remote);
assert.throws(() => unwrapReplitPublishChain([
  { commit: "d".repeat(40), tree, subject: "Published your App" },
  { commit: remote, tree: "f".repeat(40), subject: "Canonical source" },
]), /changes/);
assert.equal(selectUniqueRemoteTreeMatch(tree, [
  { commit: remote, tree, subject: "Release source" },
  { commit: "d".repeat(40), tree: "f".repeat(40), subject: "Other source" },
]).commit, remote);
assert.equal(selectUniqueRemoteTreeMatch(tree, [
  { commit: remote, tree, subject: "Release source" },
  { commit: remote, tree, subject: "Same commit through another remote ref" },
]).commit, remote);
assert.throws(() => selectUniqueRemoteTreeMatch(tree, []), /found 0/);
assert.throws(() => selectUniqueRemoteTreeMatch(tree, [
  { commit: remote, tree, subject: "First source" },
  { commit: "d".repeat(40), tree, subject: "Second source" },
]), /found 2/);

console.log("production source commit behavior: PASS");
