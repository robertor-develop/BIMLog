import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rfiUi = await readFile(new URL("../../../bimlog/src/pages/project/RfisTab.tsx", import.meta.url), "utf8");
const linkedUi = await readFile(new URL("../../../bimlog/src/components/LinkedItemsPanel.tsx", import.meta.url), "utf8");

const checks = [
  ["email draft copy uses the browser clipboard", rfiUi, /navigator\.clipboard\.writeText\(emailDraft\)/],
  ["email copy has explicit success state", rfiUi, /emailCopied \? w\("Email Copied", "Email Copiado"/],
  ["response file upload is user-facing", rfiUi, /w\("Upload Response File", "Subir Archivo de Respuesta"/],
  ["project file selection is user-facing", rfiUi, /w\("Select Project File", "Seleccionar Archivo del Proyecto"/],
  ["manual attachment rejects internal API impersonation", rfiUi, /startsWith\("\/api\/"\)[\s\S]*Use Select Project File for BIMLog files/],
  ["open references use isolated tabs", rfiUi, /window\.open\(value, "_blank", "noopener,noreferrer"\)/],
  ["linked document panel is visible", linkedUi, />Linked Documents<\/div>/],
  ["linked item refresh is explicit", linkedUi, /Refreshing\.\.\." : "Refresh items"/],
  ["linked item attach control exists", linkedUi, />\+ Attach<\/button>/],
  ["Submittal deep-create is available", linkedUi, /submittal: "submittals"[\s\S]*Create the \$\{TYPE_LABELS\[type\]\} in the new tab/],
  ["clash deep-link is isolated in a new tab", linkedUi, /Open clash reports in a new tab/],
];

for (const [label, source, pattern] of checks) assert.match(source, pattern, label);
console.log(`PASS post-P17 Build 29 RFI workflow UI (${checks.length} checks)`);
