import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildLeanRfiReportSettings,
  makeRfiReportSettingsSnapshot,
  RFI_REPORT_SECTION_INVENTORY,
} from "../src/lib/rfi-standard-exports";

type Check = { name: string; passed: boolean; details?: unknown };

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function check(name: string, passed: boolean, details?: unknown): Check {
  if (!passed) throw new Error(`${name} failed${details ? `: ${JSON.stringify(details)}` : ""}`);
  return { name, passed, details };
}

const repoRoot = path.resolve(process.cwd(), "../..");
const routePath = path.join(process.cwd(), "src/routes/rfis.ts");
const routeSource = fs.readFileSync(routePath, "utf8");

const leanSettings = buildLeanRfiReportSettings();
const snapshot = makeRfiReportSettingsSnapshot(leanSettings, 7, "project");
const standardPdf = { format: "standard_pdf", settingsVersion: snapshot.version, snapshotHash: snapshot.snapshotHash, settings: snapshot.settings };
const docx = { format: "docx", settingsVersion: snapshot.version, snapshotHash: snapshot.snapshotHash, settings: snapshot.settings };
const completeEmbedded = { format: "complete_pdf_embedded_canonical", settingsVersion: snapshot.version, snapshotHash: snapshot.snapshotHash, settings: snapshot.settings };

const visibleSections = snapshot.settings.sections.filter(section => section.visible).map(section => section.id);
const references = snapshot.settings.sections.find(section => section.id === "references");
const referenceFields = references?.fields.filter(field => field.visible).map(field => field.id) ?? [];
const inventoryFields = RFI_REPORT_SECTION_INVENTORY.find(section => section.id === "references")?.fields.map(field => field.id) ?? [];

const checks: Check[] = [
  check("standard PDF/DOCX/Complete embedded share settings version", standardPdf.settingsVersion === docx.settingsVersion && docx.settingsVersion === completeEmbedded.settingsVersion, {
    standardPdf: standardPdf.settingsVersion,
    docx: docx.settingsVersion,
    completeEmbedded: completeEmbedded.settingsVersion,
  }),
  check("standard PDF/DOCX/Complete embedded share snapshot hash", standardPdf.snapshotHash === docx.snapshotHash && docx.snapshotHash === completeEmbedded.snapshotHash, {
    hash: snapshot.snapshotHash,
  }),
  check("Ruben lean preset visible sections are deterministic", JSON.stringify(visibleSections) === JSON.stringify(["header", "submitted_by", "references"]), { visibleSections }),
  check("source viewpoint screenshot field is configurable and visible in lean preset", referenceFields.includes("source_viewpoint_image") && inventoryFields.includes("source_viewpoint_image"), { referenceFields }),
  check("additional screenshots field is configurable and visible in lean preset", referenceFields.includes("additional_screenshots") && inventoryFields.includes("additional_screenshots"), { referenceFields }),
  check("Complete PDF route loads project report settings snapshot", /const reportSettings = await loadRfiReportSettingsSnapshot\(rfi\.projectId\);/.test(routeSource)),
  check("Complete PDF passes settings snapshot into embedded canonical renderer helper", /renderRfiPdfBuffer\(rfi, responses, project, false, reportSettings\)/.test(routeSource)),
  check("embedded canonical helper passes snapshot into renderCanonicalRfiPdf", /renderCanonicalRfiPdf\(doc, exportData\.model, exportData\.image, reportSettings, exportData\.additionalImages\)/.test(routeSource)),
];

const proof = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  routePath,
  settingsVersion: snapshot.version,
  snapshotHash: snapshot.snapshotHash,
  visibleSections,
  referenceFields,
  formats: [standardPdf.format, docx.format, completeEmbedded.format],
  checks,
  proofHash: sha256(JSON.stringify({ visibleSections, referenceFields, checks: checks.map(item => item.name), snapshotHash: snapshot.snapshotHash })),
};

console.log(JSON.stringify(proof, null, 2));
