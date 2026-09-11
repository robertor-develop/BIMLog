import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../../../bimlog/src/pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");
const linked = await readFile(new URL("../../../bimlog/src/components/LinkedItemsPanel.tsx", import.meta.url), "utf8");

const checks = [
  ["packages, register, and shop-drawing views remain explicit", ui, /"submittals"[\s\S]*"register"[\s\S]*"tracking"/],
  ["new-submittal form remains a user-facing action", ui, /w\("New Submittal", "Nuevo Entregable", lang\)/],
  ["status and type filters are represented in the working UI", ui, /filterStatus[\s\S]*filterType/],
  ["filtered register supports Excel export", ui, /w\("Export Excel", "Exportar Excel", lang\)/],
  ["current-view PDF action remains available", ui, /<PrintPdfButton[\s\S]*handleExport\("pdf"\)/],
  ["shop-drawing control has independent Excel and PDF exports", ui, /Export Control Excel[\s\S]*downloadTracker\("pdf"\)/],
  ["detail exposes governed linked-item controls", ui, /<LinkedItemsPanel projectId=\{projectId\} entityType="submittal" entityId=\{submittal\.id\}/],
  ["linked RFI deep link retains active project", ui, /`\/projects\/\$\{projectId\}\/rfis\?rfi=\$\{submittal\.linkedRfiId\}`/],
  ["attachment open uses an explicit new-tab link", ui, /<a href=\{name\} target="_blank" rel="noreferrer"/],
  ["AI email action is explicitly draft-only", ui, /Draft only\. Does not send email or read attached files/],
  ["linked-item component loads candidates in the current project", linked, /projectId[\s\S]*entityType[\s\S]*entityId/],
  ["no Build diagnostic command is present", ui, /BUILD25E|BUILD26A|diagnostic probe/i, true],
];

for (const [label, source, pattern, absent] of checks) {
  if (absent) assert.doesNotMatch(source, pattern, label);
  else assert.match(source, pattern, label);
}
console.log(`PASS post-P17 Build 34 Submittal workflow UI (${checks.length} checks)`);
