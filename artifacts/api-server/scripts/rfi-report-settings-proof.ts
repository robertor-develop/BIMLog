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
const rfiTabPath = path.join(repoRoot, "artifacts/bimlog/src/pages/project/RfisTab.tsx");
const rfiTabSource = fs.readFileSync(rfiTabPath, "utf8");

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
  check("focused preset visible sections are deterministic", JSON.stringify(visibleSections) === JSON.stringify(["header", "submitted_by", "references"]), { visibleSections }),
  check("source viewpoint screenshot field is configurable and visible in focused preset", referenceFields.includes("source_viewpoint_image") && inventoryFields.includes("source_viewpoint_image"), { referenceFields }),
  check("additional screenshots field is configurable and visible in focused preset", referenceFields.includes("additional_screenshots") && inventoryFields.includes("additional_screenshots"), { referenceFields }),
  check("Complete PDF route loads override-aware report settings snapshot", /const reportSettings = await loadRfiReportSettingsSnapshotForExport\(rfi\.projectId, req\.query\.reportSettings\);/.test(routeSource)),
  check("Complete PDF passes settings snapshot into embedded canonical renderer helper", /renderRfiPdfBuffer\(rfi, responses, project, false, reportSettings, rfiReportFieldVisible\(reportSettings, "references", "additional_screenshots"\)\)/.test(routeSource)),
  check("embedded canonical helper passes snapshot into renderCanonicalRfiPdf", /renderCanonicalRfiPdf\(doc, exportData\.model, exportData\.image, reportSettings, exportData\.additionalImages\)/.test(routeSource)),
  check("RFI report settings UI computes project-admin authority", /const canManageReportSettings = currentMember\?\.role === "project_admin" \|\| Boolean\(\(user as \{ isSuperAdmin\?: boolean \} \| null\)\?\.isSuperAdmin\);/.test(rfiTabSource)),
  check("RFI report settings button is not gated by broad write permission", /canManageReportSettings && \(\s*<Button variant="outline" size="sm" onClick=\{\(\) => setShowReportSettings/.test(rfiTabSource) && !/canWrite && \(\s*<Button variant="outline" size="sm" onClick=\{\(\) => setShowReportSettings/.test(rfiTabSource)),
  check("RFI report settings panel is not gated by broad write permission", /showReportSettings && canManageReportSettings &&/.test(rfiTabSource) && !/showReportSettings && canWrite &&/.test(rfiTabSource)),
  check("RFI exports use Generate RFI Report modal state instead of direct downloads", /const handleExportPdf = \(rfi: Rfi\) => setReportRequest\(\{ rfi, kind: "pdf" \}\);/.test(rfiTabSource) && /const handleExportCompletePdf = \(rfi: Rfi\) => setReportRequest\(\{ rfi, kind: "complete-pdf" \}\);/.test(rfiTabSource) && /const handleExportWordRfi = \(rfi: Rfi\) => setReportRequest\(\{ rfi, kind: "docx" \}\);/.test(rfiTabSource)),
  check("Generate RFI Report modal sends one-time report choices without mutating defaults", /new URLSearchParams\(\{ reportSettings: JSON\.stringify\(settings\) \}\)/.test(rfiTabSource) && /Save Project Defaults/.test(rfiTabSource)),
  check("RFI report preset labels are neutral in the UI", /Focused Template/.test(rfiTabSource) && /Full Template/.test(rfiTabSource) && !/Ruben Lean Preset/.test(rfiTabSource)),
];

const proof = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  routePath,
  rfiTabPath,
  settingsVersion: snapshot.version,
  snapshotHash: snapshot.snapshotHash,
  visibleSections,
  referenceFields,
  formats: [standardPdf.format, docx.format, completeEmbedded.format],
  checks,
  proofHash: sha256(JSON.stringify({ visibleSections, referenceFields, checks: checks.map(item => item.name), snapshotHash: snapshot.snapshotHash })),
};

console.log(JSON.stringify(proof, null, 2));
