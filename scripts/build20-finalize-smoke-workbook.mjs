import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const sourcePath = "C:/Users/soporte/Downloads/BIMLog_Smoke_Test_Project_Intake_APUs (2).xlsx";
const outputPath = "F:/BIMLog/Worktrees/bimlog-smoke-intake-01-client-contact-20260907/evidence/build20/BIMLog_Smoke_Test_Project_Intake_APUs_BUILD20_FINAL.xlsx";

const evidence = [
  "Builds 2-3: bilingual quick setup and required-field/readiness proof",
  "Builds 2-3 and 17: progressive flow, contextual guidance, truthful readiness",
  "Build 3: required fields and incomplete-stage feedback",
  "Build 2: simplified default flow with optional advanced detail",
  "Builds 4-8: authoritative companies, engagements, contracts and Contract Item/APU linkage",
  "Build 18: project-scoped persistence and section restoration",
  "Build 10: immutable APU history persists and reloads",
  "Builds 9-10: create APU and retain immutable version history",
  "Builds 9 and 16: multiple APU cases with canonical budget association",
  "Generic APU 22-check regression: components and calculations",
  "Sensitive-change confirmation and immutable successor-version behavior",
  "Build 10 persistence/reload plus Generic APU regression",
  "Build 9: multiple APUs per contract",
  "Build 10: current and historical versions visible in register",
  "Build 18: active project/model isolation",
  "Builds 2, 3 and 17: ordered bilingual progressive disclosure",
  "Build 2: optional details removed from the default critical path",
  "Build 18: page/stage navigation and return-state regression",
  "Build 18: refresh persistence without cross-project leakage",
  "Build 19: complete multi-company, multi-contract, multi-APU scenario",
];

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Smoke Test");

sheet.getRange("F7:G7").values = [["Build 20 result", "Verification evidence"]];
sheet.getRange("F8:F27").values = evidence.map(() => ["PASS"]);
sheet.getRange("G8:G27").values = evidence.map((item) => [item]);
sheet.getRange("A1:G1").merge();
sheet.getRange("A1").values = [["BIMLOG — SMOKE TEST | PROJECT INTAKE + APUs | BUILD 20 FINAL"]];
sheet.getRange("B4").values = [[20]];
sheet.getRange("A29:G29").merge();
sheet.getRange("B30").values = [["PASS"]];
sheet.getRange("B31").values = [[0]];
sheet.getRange("B32").values = [["Original 20 observations reconciled to Builds 2–19; no open implementation blocker in the controlled internal suite."]];

sheet.getRange("A1:G33").format.font = { name: "Aptos", size: 10 };
sheet.getRange("A1:G1").format.fill = "#17365D";
sheet.getRange("A1:G1").format.font = { name: "Aptos Display", size: 16, bold: true, color: "#FFFFFF" };
sheet.getRange("A7:G7").format.fill = "#1F4E78";
sheet.getRange("A7:G7").format.font = { name: "Aptos", size: 10, bold: true, color: "#FFFFFF" };
sheet.getRange("F8:F27").format.fill = "#E2F0D9";
sheet.getRange("F8:F27").format.font = { name: "Aptos", size: 10, bold: true, color: "#006100" };
sheet.getRange("A29:G29").format.fill = "#17365D";
sheet.getRange("A29:G29").format.font = { name: "Aptos", size: 12, bold: true, color: "#FFFFFF" };
sheet.getRange("B30").format.fill = "#E2F0D9";
sheet.getRange("B30").format.font = { name: "Aptos", size: 11, bold: true, color: "#006100" };
sheet.getRange("A1:G33").format.wrapText = true;
sheet.getRange("A:A").format.columnWidth = 16;
sheet.getRange("B:B").format.columnWidth = 18;
sheet.getRange("C:C").format.columnWidth = 43;
sheet.getRange("D:D").format.columnWidth = 13;
sheet.getRange("E:E").format.columnWidth = 55;
sheet.getRange("F:F").format.columnWidth = 16;
sheet.getRange("G:G").format.columnWidth = 62;
sheet.getRange("3:5").format.rowHeight = 30;
sheet.getRange("8:27").format.rowHeight = 46;
sheet.getRange("30:33").format.rowHeight = 34;
sheet.freezePanes.freezeRows(7);

workbook.recalculate();
const table = await workbook.inspect({ kind: "table", range: "Smoke Test!A7:G33", include: "values,formulas", tableMaxRows: 30, tableMaxCols: 7 });
console.log(table.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "Build 20 formula error scan" });
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "Smoke Test", range: "A1:G33", scale: 1 });
await fs.writeFile(
  "F:/BIMLog/Worktrees/bimlog-smoke-intake-01-client-contact-20260907/evidence/build20/BIMLog_Smoke_Test_Project_Intake_APUs_BUILD20_FINAL.png",
  new Uint8Array(await preview.arrayBuffer()),
);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
