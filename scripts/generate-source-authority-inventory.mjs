import fs from "node:fs";
import path from "node:path";
import { inspectSourceAuthority } from "./source-authority-inventory.mjs";

const outputIndex = process.argv.indexOf("--output");
if (outputIndex === -1 || !process.argv[outputIndex + 1]) throw new Error("--output <path> is required");
const target = path.resolve(process.argv[outputIndex + 1]);
const result = inspectSourceAuthority();
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", output: target, worktreeCounts: result.worktreeCounts, branchCounts: result.branchCounts }));
