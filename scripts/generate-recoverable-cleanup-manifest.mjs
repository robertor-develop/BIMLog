import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const inventoryPath = "evidence/stabilization-program-20260919/SOURCE_AUTHORITY_INVENTORY.json";
const source = fs.readFileSync(inventoryPath, "utf8");
const inventory = JSON.parse(source);
const slug = (value) => value.replace(/^[A-Za-z]:/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-96);
const archiveRoot = "F:/BIMLog/Archives/recoverable-worktrees";

const worktrees = inventory.worktrees.filter((item) => item.disposition === "RETIRE").map((item) => {
  const identity = `${slug(item.branch ?? item.path)}-${item.head.slice(0, 12)}`;
  return {
    sourcePath: item.path,
    branch: item.branch,
    head: item.head,
    prunable: item.prunable,
    preservationDirectory: `${archiveRoot}/${identity}`,
    requiredEvidence: [
      "source-identity.json",
      "tracked-and-binary.patch",
      "untracked-file-manifest.json",
      "branch.bundle",
      "sha256-manifest.json",
      "restore-verification.json"
    ],
    removalAllowed: false,
    removalPreconditions: [
      "exact source head and branch recorded",
      "tracked and binary diff captured even when empty",
      "untracked names, sizes, and hashes captured",
      "bundle verifies and recreates the exact head",
      "archive hash manifest verifies",
      "restore rehearsal succeeds outside the source path",
      "Roberto separately authorizes the exact removal target"
    ]
  };
});

const branches = inventory.branches.filter((item) => item.disposition === "RETIRE").map((item) => ({
  branch: item.branch,
  head: item.head,
  preservationBundle: `${archiveRoot}/branches/${slug(item.branch)}-${item.head.slice(0, 12)}.bundle`,
  deletionAllowed: false,
  deletionPreconditions: [
    "branch is not checked out",
    "bundle verifies and recreates the exact head",
    "head is represented in the worktree preservation manifest or a dedicated bundle",
    "Roberto separately authorizes the exact branch deletion"
  ]
}));

const manifest = {
  schemaVersion: 1,
  sourceInventory: inventoryPath,
  sourceInventorySha256: crypto.createHash("sha256").update(source.replace(/\r\n?/g, "\n")).digest("hex"),
  sourceHead: inventory.sourceHead,
  executionAuthorized: false,
  broadRecursiveActionAllowed: false,
  archiveRoot,
  worktreeCount: worktrees.length,
  branchCount: branches.length,
  worktrees,
  branches
};

const outputIndex = process.argv.indexOf("--output");
if (outputIndex === -1 || !process.argv[outputIndex + 1]) throw new Error("--output <path> is required");
const target = path.resolve(process.argv[outputIndex + 1]);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", output: target, worktrees: worktrees.length, branches: branches.length, executionAuthorized: false }));
