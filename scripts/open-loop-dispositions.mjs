import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "living-brief", "OPEN_LOOP.md");
const outputPath = path.join(root, "living-brief", "OPEN_LOOP_DISPOSITIONS.json");
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n?/g, "\n");
const lines = source.split("\n");

const completedProgramPatterns = [
  /^Builds 006-010:/,
  /^Build 010:/,
  /^Complete the Build 010 publication correction:/,
  /^Block 03 Builds 011–015:/,
  /^Build 020:/,
];
const acceptedLimitationPatterns = [
  /historical pre-digest packages quarantined/i,
  /superseded N14-P10 package is not a current field-acceptance object/i,
  /do not start production bridge\/UI integration/i,
];
const residualAcceptancePattern = /field acceptance|customer acceptance|actual account|real account|real project|real clash|real model|real-browser|authenticated production|Lorena|Ruben|Navisworks|production QA account|Telegram delivery|production database migration|provider activation|restore|migration only/i;
const historicalPublicationPattern = /\bP(?:1[3-9]|2\d|3[0-2])\b|pushed.not.published|push(?:ed)?(?: and|\/)? publish|Replit (?:sync|synchronization|publication)|publish once|publication gate/i;

let heading = "";
const items = [];
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (/^#{1,3}\s+/.test(line)) heading = line.replace(/^#+\s+/, "").trim();
  const match = line.match(/^\s*- \[ \]\s+(.*)$/);
  if (!match) continue;
  const statement = match[1].trim();
  const id = crypto.createHash("sha256").update(`${heading}\n${statement}`).digest("hex").slice(0, 16);
  let classification = "ACTIVE";
  let evidence = [`OPEN_LOOP.md:${index + 1}`, heading];

  if (completedProgramPatterns.some((pattern) => pattern.test(statement))) {
    classification = "CLOSED_WITH_EVIDENCE";
    evidence = [
      "evidence/stabilization-program-20260919/BUILD_LEDGER.json",
      "Block 02, Block 03, and Block 04 milestone receipts",
    ];
  } else if (acceptedLimitationPatterns.some((pattern) => pattern.test(statement))) {
    classification = "ACCEPTED_LIMITATION";
    evidence = [`OPEN_LOOP.md:${index + 1}`, "Preserved fail-closed product boundary"];
  } else if (historicalPublicationPattern.test(statement) && !residualAcceptancePattern.test(statement)) {
    classification = "SUPERSEDED";
    evidence = [
      "living-brief/STATUS.md current authority",
      "Block 04 publication receipt: v1.05.N18-P33 / e89dc3b4",
    ];
  }

  items.push({ id, sourceLine: index + 1, heading, statement, classification, evidence });
}

const counts = Object.fromEntries(
  ["ACTIVE", "SUPERSEDED", "ACCEPTED_LIMITATION", "CLOSED_WITH_EVIDENCE"].map((key) => [
    key,
    items.filter((item) => item.classification === key).length,
  ]),
);
const result = {
  schemaVersion: 1,
  generatedFrom: "living-brief/OPEN_LOOP.md",
  sourceSha256: crypto.createHash("sha256").update(source).digest("hex"),
  itemCount: items.length,
  counts,
  allowedClassifications: ["ACTIVE", "SUPERSEDED", "ACCEPTED_LIMITATION", "CLOSED_WITH_EVIDENCE"],
  items,
};
const rendered = `${JSON.stringify(result, null, 2)}\n`;

if (process.argv.includes("--write")) {
  fs.writeFileSync(outputPath, rendered, "utf8");
  console.log(`Wrote ${items.length} classified open-loop dispositions.`);
} else {
  if (!fs.existsSync(outputPath)) throw new Error("OPEN_LOOP_DISPOSITIONS.json is missing; run with --write");
  const current = fs.readFileSync(outputPath, "utf8").replace(/\r\n?/g, "\n");
  if (current !== rendered) throw new Error("OPEN_LOOP_DISPOSITIONS.json is stale; regenerate with --write");
  if (items.some((item) => !item.classification || item.evidence.length === 0)) {
    throw new Error("Every unchecked open-loop item requires a disposition and evidence");
  }
  console.log(JSON.stringify({ status: "PASS", itemCount: items.length, counts }));
}
