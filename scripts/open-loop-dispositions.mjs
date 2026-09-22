import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "living-brief", "OPEN_LOOP.md");
const outputPath = path.join(root, "living-brief", "OPEN_LOOP_DISPOSITIONS.json");
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n?/g, "\n");
const lines = source.split("\n");
const currentAuthorityMarker = "CURRENT_OPEN_LOOP_AUTHORITY";
const markedAuthorityLine = lines.findIndex((line) => line.includes(currentAuthorityMarker));
if (markedAuthorityLine < 0) throw new Error("OPEN_LOOP must contain exactly one marked current authority section");
if (lines.filter((line) => line.includes(currentAuthorityMarker)).length !== 1)
  throw new Error("OPEN_LOOP contains duplicate current-authority markers");

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
const providerEvidencePattern = /publish|deploy|Replit|provider|migration|restore|schema preview|production artifact|release gate|push the exact|synchroniz/i;
const fieldEvidencePattern = /field acceptance|customer acceptance|actual account|real account|real project|real clash|real model|real-browser|authenticated production|Lorena|Ruben|Navisworks|production QA account|live Chrome|live browser/i;
const knownClosedCheckpointPattern = /Build 100 release|Build 115 head|Builds 116[–-]120|Build 120 exact|Build 160:|Builds 166[–-]170|Build 170|Build 070 release|Builds 111[–-]115|Builds 106[–-]110/i;

function productOwner(heading, statement) {
  const value = `${heading} ${statement}`;
  if (/Coordination Knowledge Library/i.test(value)) return { owner: "Lens Next", route: "/lens-next", module: "artifacts/bimlog/src/features/lens-next" };
  if (/Lens|Navisworks|clash/i.test(value)) return { owner: "Lens Next", route: "/lens-next", module: "artifacts/bimlog/src/features/lens-next" };
  if (/RFI/i.test(value)) return { owner: "RFI", route: "/projects/:id/rfis", module: "artifacts/bimlog/src/pages/project/RfisTab.tsx" };
  if (/Submittal/i.test(value)) return { owner: "Submittals", route: "/projects/:id/submittals", module: "artifacts/bimlog/src/pages/project/SubmittalsTab.tsx" };
  if (/Meeting/i.test(value)) return { owner: "Meetings", route: "/projects/:id/meetings", module: "artifacts/bimlog/src/pages/project/MeetingsTab.tsx" };
  if (/Intake/i.test(value)) return { owner: "Job Intake", route: "/projects/:id/intake", module: "artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx" };
  if (/APU|Pricing|Commercial/i.test(value)) return { owner: "Commercial", route: "/projects/:id/financial/apu", module: "artifacts/bimlog/src/pages/FinancialApuWorkspace.tsx" };
  if (/Dashboard|Governance|Workflow/i.test(value)) return { owner: "Headquarters", route: "/dashboard", module: "artifacts/bimlog/src/pages/Dashboard.tsx" };
  if (/Feedback/i.test(value)) return { owner: "Feedback", route: "/feedback", module: "artifacts/bimlog/src/components/FeedbackWidget.tsx" };
  return { owner: "Platform", route: "/dashboard", module: "artifacts/bimlog/src/App.tsx" };
}

let heading = "";
const items = [];
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (/^#{1,3}\s+/.test(line)) heading = line.replace(/^#+\s+/, "").trim();
  const match = line.match(/^\s*- \[ \]\s+(.*)$/);
  if (!match) continue;
  const statement = match[1].trim();
  const isCurrentAuthority = index > markedAuthorityLine && index < lines.findIndex((candidate, candidateIndex) => candidateIndex > markedAuthorityLine && /^##\s+/.test(candidate));
  const id = crypto.createHash("sha256").update(`${heading}\n${statement}`).digest("hex").slice(0, 16);
  let classification = "ACTIVE";
  let evidence = [`OPEN_LOOP.md:${index + 1}`, heading];

  if (!isCurrentAuthority && knownClosedCheckpointPattern.test(statement)) {
    classification = "CLOSED_WITH_EVIDENCE";
    evidence = [
      "git:9dab04343e90e8ad94391c5967a4b9f804ee1f4d",
      "evidence/stabilization-program-20260919/BUILD_180_SOURCE_ACCEPTANCE.md",
      "test:gate:pre-push PASS through Build 185",
    ];
  } else if (completedProgramPatterns.some((pattern) => pattern.test(statement))) {
    classification = "CLOSED_WITH_EVIDENCE";
    evidence = [
      "evidence/stabilization-program-20260919/BUILD_LEDGER.json",
      "Block 02, Block 03, and Block 04 milestone receipts",
    ];
  } else if (acceptedLimitationPatterns.some((pattern) => pattern.test(statement))) {
    classification = "ACCEPTED_LIMITATION";
    evidence = [`OPEN_LOOP.md:${index + 1}`, "Preserved fail-closed product boundary"];
  } else if (!isCurrentAuthority && historicalPublicationPattern.test(statement) && !residualAcceptancePattern.test(statement)) {
    classification = "SUPERSEDED";
    evidence = [
      "living-brief/STATUS.md current authority",
      "Block 04 publication receipt: v1.05.N18-P33 / e89dc3b4",
    ];
  }

  const workClass = classification === "SUPERSEDED" || classification === "CLOSED_WITH_EVIDENCE"
    ? "STALE_CONTRADICTION"
    : fieldEvidencePattern.test(statement)
      ? "FIELD_EVIDENCE"
      : providerEvidencePattern.test(statement)
        ? "PROVIDER_EVIDENCE"
        : "PRODUCT_WORK";
  const ownership = workClass === "PRODUCT_WORK"
    ? productOwner(heading, statement)
    : workClass === "FIELD_EVIDENCE"
      ? { owner: "Field acceptance", route: null, module: "evidence/field-acceptance" }
      : workClass === "PROVIDER_EVIDENCE"
        ? { owner: "Release engineering", route: null, module: "docs/deployment" }
        : { owner: "Historical evidence", route: null, module: "living-brief/OPEN_LOOP.md" };

  items.push({ id, sourceLine: index + 1, heading, statement, classification, workClass, ownership, evidence, currentAuthority: isCurrentAuthority });
}

const normalized = new Map();
const duplicateGroups = [];
for (const item of items) {
  const key = item.statement.toLowerCase().replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
  if (normalized.has(key)) {
    const canonicalId = normalized.get(key);
    duplicateGroups.push({ canonicalId, duplicateId: item.id });
    item.classification = "SUPERSEDED";
    item.workClass = "STALE_CONTRADICTION";
    item.ownership = { owner: "Historical evidence", route: null, module: "living-brief/OPEN_LOOP.md" };
    item.evidence = [`canonical-open-loop:${canonicalId}`, `duplicate-source:${item.id}`];
  } else normalized.set(key, item.id);
}
const duplicateStatements = duplicateGroups.filter(({ canonicalId, duplicateId }) => {
  const canonical = items.find((item) => item.id === canonicalId);
  const duplicate = items.find((item) => item.id === duplicateId);
  return canonical?.classification === "ACTIVE" && duplicate?.classification === "ACTIVE";
});

const counts = Object.fromEntries(
  ["ACTIVE", "SUPERSEDED", "ACCEPTED_LIMITATION", "CLOSED_WITH_EVIDENCE"].map((key) => [
    key,
    items.filter((item) => item.classification === key).length,
  ]),
);
const result = {
  schemaVersion: 2,
  generatedFrom: "living-brief/OPEN_LOOP.md",
  sourceSha256: crypto.createHash("sha256").update(source).digest("hex"),
  itemCount: items.length,
  counts,
  allowedClassifications: ["ACTIVE", "SUPERSEDED", "ACCEPTED_LIMITATION", "CLOSED_WITH_EVIDENCE"],
  allowedWorkClasses: ["PRODUCT_WORK", "FIELD_EVIDENCE", "PROVIDER_EVIDENCE", "STALE_CONTRADICTION"],
  currentAuthority: {
    marker: currentAuthorityMarker,
    heading: lines[markedAuthorityLine].replace(/^#+\s+/, "").replace(/\s*<!--.*$/, "").trim(),
    uncheckedItems: items.filter((item) => item.currentAuthority).map((item) => item.id),
  },
  duplicateStatements,
  reconciledDuplicateGroups: duplicateGroups,
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
  if (items.some((item) => !result.allowedWorkClasses.includes(item.workClass) || !item.ownership?.owner || !item.ownership?.module))
    throw new Error("Every unchecked open-loop item requires a governed work class and owner binding");
  if (duplicateStatements.length) throw new Error(`Duplicate unchecked open-loop statements: ${JSON.stringify(duplicateStatements)}`);
  const currentAuthorityItems = items.filter((item) => item.currentAuthority);
  const currentProductWork = currentAuthorityItems.filter((item) => item.workClass === "PRODUCT_WORK");
  const currentFieldEvidence = currentAuthorityItems.filter((item) => item.workClass === "FIELD_EVIDENCE");
  const currentProviderEvidence = currentAuthorityItems.filter((item) => item.workClass === "PROVIDER_EVIDENCE");
  if (
    result.currentAuthority.uncheckedItems.length !== 2 + currentProviderEvidence.length ||
    currentFieldEvidence.length !== 1 ||
    currentProductWork.length !== 1 ||
    currentProviderEvidence.length > 1 ||
    currentProviderEvidence.some((item) => !/\bpublish\b|publication/i.test(item.statement)) ||
    !currentFieldEvidence.some((item) => item.statement.includes("Navisworks 2025")) ||
    currentProviderEvidence.some((item) => !item.statement.includes("Build 265")) ||
    !currentProductWork.some((item) => item.statement.includes("Builds 261–264"))
  ) {
    throw new Error("The marked current authority must contain the next Coordination Knowledge product block, any active publication boundary, and Ruben's deferred physical Navisworks 2025 field evidence");
  }
  console.log(JSON.stringify({ status: "PASS", itemCount: items.length, counts }));
}
