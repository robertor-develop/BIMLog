import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

const workbookPath = path.resolve(
  process.cwd(),
  "../../evidence/build20/BIMLog_Smoke_Test_Project_Intake_APUs_BUILD20_FINAL.xlsx",
);
const expectedSha256 = "10F1918DBD947B84FD04405B162C8388F60A255239C091468864AFDBCE981E58";
const bytes = fs.readFileSync(workbookPath);
assert.equal(createHash("sha256").update(bytes).digest("hex").toUpperCase(), expectedSha256);

const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
assert.deepEqual(workbook.SheetNames, ["Smoke Test"]);
const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Smoke Test"], {
  header: 1,
  defval: null,
});

const acceptanceRows = rows.slice(7, 27);
assert.equal(acceptanceRows.length, 20);
assert.deepEqual(acceptanceRows.map((row) => row[0]), Array.from({ length: 20 }, (_, index) => index + 1));
assert.ok(acceptanceRows.every((row) => row[5] === "PASS"));
assert.ok(acceptanceRows.every((row) => typeof row[6] === "string" && String(row[6]).trim().length > 0));
assert.deepEqual(
  acceptanceRows.reduce<Record<string, number>>((counts, row) => {
    const area = String(row[1]);
    counts[area] = (counts[area] ?? 0) + 1;
    return counts;
  }, {}),
  { "Project Intake": 7, APU: 8, UX: 2, General: 3 },
);

assert.equal(rows[29]?.[1], "PASS");
assert.equal(rows[30]?.[1], 0);
assert.equal(rows[32]?.[1], "15–20 minutos");

console.log(JSON.stringify({
  suite: "post-p17-apu-workbook-acceptance",
  status: "PASS",
  workbookSha256: expectedSha256,
  acceptanceRows: acceptanceRows.length,
  result: rows[29]?.[1],
  blockers: rows[30]?.[1],
}, null, 2));
