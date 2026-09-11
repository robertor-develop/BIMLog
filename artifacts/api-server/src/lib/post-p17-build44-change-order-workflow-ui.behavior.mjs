import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../../../bimlog/src/pages/project/ChangeOrdersTab.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../routes/change_orders.ts", import.meta.url), "utf8");

const checks = [
  ["create remains an explicit user action", ui, /New Change Order", "Nueva Orden"/],
  ["import remains write-authorized UI", ui, /handleImport[\s\S]*Importing\.\.\.[\s\S]*Import/],
  ["status search and sort define current view", ui, /STATUS_FILTERS[\s\S]*setSearch[\s\S]*setSort/],
  ["current-view PDF uses governed control", ui, /<PrintPdfButton[\s\S]*onClick=\{exportCurrentViewPdf\}/],
  ["PDF request carries exact current-view scope", ui, /status: filter,[\s\S]*search: search\.trim\(\),[\s\S]*sort,/],
  ["financial schedule company and dates are selectable", ui, /includeFinancial[\s\S]*includeSchedule[\s\S]*includeCompany[\s\S]*includeDates/],
  ["individual report has explicit PDF action", ui, /Change Order PDF", "PDF de orden de cambio"/],
  ["delete uses governed confirmation", ui, /<DeleteConfirmModal[\s\S]*Linked RFIs\/submittals will be detached/],
  ["current-view API validates filters", api, /allowedStatuses[\s\S]*allowedSorts[\s\S]*invalid_include_option/],
  ["current-view report records a content fingerprint", api, /computeContentHash\([\s\S]*addPageNumbers\(/],
  ["no internal diagnostic command is exposed", ui, /BUILD25E|BUILD26A|diagnostic probe/i, true],
];

for (const [label, source, pattern, absent] of checks) {
  if (absent) assert.doesNotMatch(source, pattern, label);
  else assert.match(source, pattern, label);
}
console.log(`PASS post-P17 Build 44 Change Order workflow UI (${checks.length} checks)`);
