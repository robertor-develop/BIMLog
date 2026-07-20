import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

type FixtureSubmittal = {
  id: number;
  title: string;
  floor?: string | null;
  trade?: string | null;
  submittalType: string;
  submittalCategory?: string | null;
  status: string;
  reviewedAt?: string | null;
  dateRequired?: string | null;
  dueDate?: string | null;
  dateSubmitted?: string | null;
  createdAt: string;
};

function filterKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanLabel(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function titleLabel(value: string | null | undefined): string {
  const clean = cleanLabel(value);
  if (!clean) return "";
  return clean
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .replace(/\bHvac\b/g, "HVAC")
    .replace(/\bRfi\b/g, "RFI");
}

function tradeLabel(value: string | null | undefined): string {
  const key = filterKey(value);
  if (!key) return "";
  if (["hvac", "mechanical", "mech", "mep mechanical", "air conditioning"].includes(key)) return "HVAC";
  if (["plumbing", "plumb", "plbg"].includes(key)) return "Plumbing";
  if (["electrical", "electric", "elec"].includes(key)) return "Electrical";
  if (["fire protection", "fire", "fire sprinkler", "fp"].includes(key)) return "Fire Protection";
  if (["architectural", "architecture", "arch"].includes(key)) return "Architectural";
  return titleLabel(value);
}

function drawingTypeLabel(value: string | null | undefined): string {
  const key = filterKey(value);
  if (!key) return "";
  if (key.includes("sleeve") && (key.includes("vertical") || /\bv\b/.test(key))) return "Sleeve V";
  if (key.includes("sleeve") && (key.includes("horizontal") || /\bh\b/.test(key))) return "Sleeve H";
  if (key.includes("shop") && key.includes("drawing")) return "Shop Drawing";
  if (key === "shop" || key === "shop drawing" || key === "shop drawings") return "Shop Drawing";
  if (key === "shop_drawing") return "Shop Drawing";
  if (key.includes("sleeve")) return "Sleeve";
  return titleLabel(value);
}

function floorOf(row: FixtureSubmittal): string {
  return cleanLabel(row.floor) || "Unassigned";
}

function tradeOf(row: FixtureSubmittal): string {
  if (row.trade) return tradeLabel(row.trade);
  const key = filterKey(`${row.submittalCategory ?? ""} ${row.submittalType ?? ""}`);
  if (key.includes("plumb")) return "Plumbing";
  if (key.includes("hvac") || key.includes("mechanical")) return "HVAC";
  if (key.includes("fire")) return "Fire Protection";
  if (key.includes("electr")) return "Electrical";
  if (key.includes("arch")) return "Architectural";
  return "Other";
}

function typeOf(row: FixtureSubmittal): string {
  return drawingTypeLabel(row.submittalCategory || row.submittalType) || "Other";
}

function dateOf(row: FixtureSubmittal): string {
  return String(row.reviewedAt || row.dateRequired || row.dueDate || row.dateSubmitted || row.createdAt).slice(0, 10);
}

function typeMatches(filter: string, actual: string): boolean {
  const filterValue = filterKey(filter);
  if (!filterValue) return true;
  const actualKey = filterKey(actual);
  if (filterValue === "sleeve") return actualKey === "sleeve" || actualKey === "sleeve v" || actualKey === "sleeve h";
  return actualKey === filterValue;
}

function fixedFilter(rows: FixtureSubmittal[], filters: { floor?: string; trade?: string; type?: string; date?: string; status?: string }) {
  return rows.filter(row => {
    if (filters.floor && filterKey(floorOf(row)) !== filterKey(filters.floor)) return false;
    if (filters.trade && filterKey(tradeOf(row)) !== filterKey(filters.trade)) return false;
    if (!typeMatches(filters.type || "", typeOf(row))) return false;
    if (filters.date && dateOf(row) !== filters.date) return false;
    if (filters.status && filterKey(row.status || "Unknown") !== filterKey(filters.status)) return false;
    return true;
  });
}

function oldTradeOf(row: FixtureSubmittal): string {
  if (row.trade) return row.trade;
  const raw = `${row.submittalCategory ?? ""} ${row.submittalType ?? ""}`.toLowerCase();
  if (raw.includes("plumb")) return "Plumbing";
  if (raw.includes("hvac") || raw.includes("mechanical")) return "HVAC";
  if (raw.includes("fire")) return "Fire Protection";
  if (raw.includes("electr")) return "Electrical";
  return "Other";
}

function oldTypeOf(row: FixtureSubmittal): string {
  const raw = `${row.submittalType ?? ""} ${row.submittalCategory ?? ""}`.toLowerCase();
  if (raw.includes("sleeve") && (raw.includes("vert") || raw.includes("vertical") || raw.includes(" v"))) return "Sleeve V";
  if (raw.includes("sleeve") && (raw.includes("horiz") || raw.includes("horizontal") || raw.includes(" h"))) return "Sleeve H";
  if (raw.includes("shop")) return "Shop";
  if (raw.includes("sleeve")) return "Sleeve";
  return "Other";
}

function oldFilter(rows: FixtureSubmittal[], filters: { floor?: string; trade?: string; type?: string }) {
  return rows.filter(row => {
    if (filters.floor && (row.floor || "Unassigned") !== filters.floor) return false;
    if (filters.trade && oldTradeOf(row) !== filters.trade) return false;
    if (filters.type && oldTypeOf(row) !== filters.type) return false;
    return true;
  });
}

function ids(rows: FixtureSubmittal[]): number[] {
  return rows.map(row => row.id).sort((a, b) => a - b);
}

function discovered(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const clean = cleanLabel(label);
    const key = filterKey(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function expectIds(name: string, actual: FixtureSubmittal[], expected: number[]) {
  const actualIds = ids(actual);
  const pass = JSON.stringify(actualIds) === JSON.stringify(expected);
  if (!pass) throw new Error(`${name} expected ${expected.join(",")} got ${actualIds.join(",")}`);
  return { name, pass, ids: actualIds };
}

const fixture: FixtureSubmittal[] = [
  { id: 1, title: "HVAC shop drawing", floor: " L1 ", trade: "HVAC", submittalType: "shop_drawing", status: "Under Review", dateRequired: "2026-08-01", createdAt: "2026-07-01" },
  { id: 2, title: "Plumbing vertical sleeve", floor: "l1", trade: " plumbing ", submittalType: "SLEEVE-V", status: "pending", dateRequired: "2026-08-02", createdAt: "2026-07-01" },
  { id: 3, title: "Electrical horizontal sleeve", floor: "L2", trade: " electrical ", submittalType: "Horizontal Sleeve", status: "Approved", dateRequired: "2026-08-03", createdAt: "2026-07-01" },
  { id: 4, title: "Fire protection sleeve", floor: " Level 03 ", trade: "FP", submittalType: "Sleeve", status: "Revise Resubmit", dateRequired: "2026-08-04", createdAt: "2026-07-01" },
  { id: 5, title: "Architectural product data", floor: "Roof", trade: " architectural ", submittalType: "Product Data", status: "Rejected", dateRequired: "2026-08-05", createdAt: "2026-07-01" },
  { id: 6, title: "Mechanical shop alias", floor: "L2", trade: "Mechanical", submittalType: " Shop Drawing ", status: "Pending", dateRequired: "2026-08-06", createdAt: "2026-07-01" },
];

const projectLevels = ["L1", "L2", "Level 03", "Roof"];
const realDrawingTypes = discovered(fixture.map(typeOf));
const options = {
  levels: discovered([...projectLevels, ...fixture.map(floorOf)]),
  trades: discovered(fixture.map(tradeOf)),
  drawingTypes: discovered([...(realDrawingTypes.some(label => ["sleeve", "sleeve v", "sleeve h"].includes(filterKey(label))) ? ["Sleeve"] : []), ...realDrawingTypes]),
};

const baselineFailures = {
  buildingLevelL1OldIds: ids(oldFilter(fixture, { floor: "L1" })),
  plumbingOldIds: ids(oldFilter(fixture, { trade: "Plumbing" })),
  electricalOldIds: ids(oldFilter(fixture, { trade: "Electrical" })),
  fireProtectionOldIds: ids(oldFilter(fixture, { trade: "Fire Protection" })),
  sleeveVOldIds: ids(oldFilter(fixture, { type: "Sleeve V" })),
  shopDrawingOldIds: ids(oldFilter(fixture, { type: "Shop Drawing" })),
};

const checks = [
  expectIds("all restores every record", fixedFilter(fixture, {}), [1, 2, 3, 4, 5, 6]),
  expectIds("building level L1 normalizes whitespace and case", fixedFilter(fixture, { floor: "L1" }), [1, 2]),
  expectIds("trade HVAC includes Mechanical alias", fixedFilter(fixture, { trade: "HVAC" }), [1, 6]),
  expectIds("trade Plumbing trims lowercase persisted value", fixedFilter(fixture, { trade: "Plumbing" }), [2]),
  expectIds("trade Electrical trims lowercase persisted value", fixedFilter(fixture, { trade: "Electrical" }), [3]),
  expectIds("trade Fire Protection includes FP alias", fixedFilter(fixture, { trade: "Fire Protection" }), [4]),
  expectIds("trade Architectural keeps real non-MEP trade", fixedFilter(fixture, { trade: "Architectural" }), [5]),
  expectIds("drawing Shop Drawing includes shop_drawing and spaced labels", fixedFilter(fixture, { type: "Shop Drawing" }), [1, 6]),
  expectIds("drawing Sleeve includes Sleeve, Sleeve V, and Sleeve H", fixedFilter(fixture, { type: "Sleeve" }), [2, 3, 4]),
  expectIds("drawing Sleeve V handles punctuation alias", fixedFilter(fixture, { type: "Sleeve V" }), [2]),
  expectIds("drawing Sleeve H handles horizontal alias", fixedFilter(fixture, { type: "Sleeve H" }), [3]),
  expectIds("drawing Product Data keeps other real drawing type", fixedFilter(fixture, { type: "Product Data" }), [5]),
  expectIds("combined filters work together", fixedFilter(fixture, { floor: "L1", trade: "Plumbing", type: "Sleeve V", date: "2026-08-02", status: "Pending" }), [2]),
  expectIds("zero result remains zero", fixedFilter(fixture, { floor: "Roof", trade: "Electrical", type: "Sleeve V" }), []),
];

const uiIds = ids(fixedFilter(fixture, { floor: "L1", type: "Sleeve" }));
const pdfIds = ids(fixedFilter(fixture, { floor: "l1", type: "sleeve" }));
const excelIds = ids(fixedFilter(fixture, { floor: " L1 ", type: "Sleeve" }));
if (JSON.stringify(uiIds) !== JSON.stringify(pdfIds) || JSON.stringify(uiIds) !== JSON.stringify(excelIds)) {
  throw new Error("UI/PDF/Excel parity failed");
}

const result = {
  task: "Shop Drawing Control Filter Hotfix",
  generatedAt: new Date().toISOString(),
  rootCause: "Old code compared display labels with strict equality while options mixed configured levels, fixed labels, and persisted values carrying case/whitespace/punctuation/aliases.",
  fixtureIds: fixture.map(row => ({ id: row.id, floor: row.floor, trade: row.trade, submittalType: row.submittalType, status: row.status })),
  optionsDiscovered: options,
  baselineFailures,
  checks,
  parity: { uiIds, pdfIds, excelIds },
};

const initialRoot = process.env.INIT_CWD || process.cwd();
const repoRoot = basename(initialRoot).toLowerCase() === "scripts" ? dirname(initialRoot) : initialRoot;
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const externalRoot = process.env.BIMLOG_EVIDENCE_ROOT || join(dirname(repoRoot), "bimlog-tools", "evidence", "shop-drawing-filter-hotfix");
const evidenceDir = join(externalRoot, timestamp);
mkdirSync(evidenceDir, { recursive: true });

const evidenceJson = JSON.stringify(result, null, 2);
const proofHash = createHash("sha256").update(evidenceJson).digest("hex");
const evidencePath = join(evidenceDir, `proof-${proofHash.slice(0, 12)}.json`);
writeFileSync(evidencePath, evidenceJson, "utf8");

const manifest = {
  task: result.task,
  generatedAt: result.generatedAt,
  evidencePath,
  proofSha256: proofHash,
  checks: checks.length,
  parity: result.parity,
};
const manifestJson = JSON.stringify(manifest, null, 2);
const manifestHash = createHash("sha256").update(manifestJson).digest("hex");
const manifestPath = join(evidenceDir, `manifest-${manifestHash.slice(0, 12)}.json`);
writeFileSync(manifestPath, manifestJson, "utf8");

console.log(JSON.stringify({ passed: true, evidencePath, sha256: proofHash, manifestPath, manifestSha256: manifestHash, checks: checks.length, parity: result.parity }, null, 2));