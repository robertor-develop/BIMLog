import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!output) throw new Error("Use --output with the tracked census receipt path.");

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .sort();

const binaryExtensions = new Set([
  ".7z", ".bmp", ".dll", ".docx", ".exe", ".gif", ".ico", ".jpg", ".jpeg",
  ".nupkg", ".pdf", ".pdb", ".png", ".so", ".webp", ".xlsx", ".zip",
]);
const sourceExtensions = new Set([
  ".c", ".config", ".cs", ".css", ".h", ".html", ".js", ".json", ".jsx",
  ".md", ".mjs", ".ps1", ".sql", ".ts", ".tsx", ".xml", ".yaml", ".yml",
]);

const byTopLevel = new Map();
const byExtension = new Map();
let trackedBytes = 0;
let textFiles = 0;
let binaryFiles = 0;
let textLines = 0;
let sourceFiles = 0;
let sourceLines = 0;

for (const relative of tracked) {
  const absolute = path.join(root, relative);
  const bytes = fs.readFileSync(absolute);
  trackedBytes += bytes.length;
  const extension = path.extname(relative).toLowerCase() || "<none>";
  const topLevel = relative.replaceAll("\\", "/").split("/")[0];
  const binary = binaryExtensions.has(extension) || bytes.includes(0);
  const lineCount = binary ? 0 : bytes.length === 0 ? 0 : bytes.toString("utf8").replace(/\r\n?/g, "\n").split("\n").length;
  if (binary) binaryFiles += 1;
  else {
    textFiles += 1;
    textLines += lineCount;
  }
  if (!binary && sourceExtensions.has(extension)) {
    sourceFiles += 1;
    sourceLines += lineCount;
  }
  const top = byTopLevel.get(topLevel) ?? { files: 0, bytes: 0, textLines: 0 };
  top.files += 1;
  top.bytes += bytes.length;
  top.textLines += lineCount;
  byTopLevel.set(topLevel, top);
  const ext = byExtension.get(extension) ?? { files: 0, bytes: 0, textLines: 0 };
  ext.files += 1;
  ext.bytes += bytes.length;
  ext.textLines += lineCount;
  byExtension.set(extension, ext);
}

const receipt = {
  schemaVersion: 1,
  status: "PASS",
  scope: "all Git-tracked repository files at the Build 216 candidate",
  totals: { trackedFiles: tracked.length, trackedBytes, textFiles, binaryFiles, textLines, sourceFiles, sourceLines },
  byTopLevel: Object.fromEntries([...byTopLevel.entries()].sort(([a], [b]) => a.localeCompare(b))),
  byExtension: Object.fromEntries([...byExtension.entries()].sort(([a], [b]) => a.localeCompare(b))),
};
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(path.resolve(output), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`REPOSITORY_CENSUS=PASS tracked=${tracked.length} text=${textFiles} binary=${binaryFiles} lines=${textLines} sourceFiles=${sourceFiles} sourceLines=${sourceLines}`);
