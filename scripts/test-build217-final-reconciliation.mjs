import fs from "node:fs";

const audit = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/BUILD_216_PLATFORM_AUDIT.json", "utf8"));
const census = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/BUILD_216_REPOSITORY_CENSUS.json", "utf8"));
const open = JSON.parse(fs.readFileSync("living-brief/OPEN_LOOP_DISPOSITIONS.json", "utf8"));
const current = open.items.filter((item) => item.currentAuthority && item.classification === "ACTIVE");
const provider = current.filter((item) => item.workClass === "PROVIDER_EVIDENCE");
const field = current.filter((item) => item.workClass === "FIELD_EVIDENCE");
const product = current.filter((item) => item.workClass === "PRODUCT_WORK");

if (census.status !== "PASS" || census.totals.trackedFiles < 1 || census.totals.sourceLines < 1)
  throw new Error("Build 216 repository census is missing or empty.");
if (audit.status !== "PASS" || audit.counts.P0 !== 0 || audit.baseline.unexpectedP1.length !== 0)
  throw new Error("Final audit contains a P0 or an unclassified P1 identity.");
if (provider.length !== 1 || !provider[0].statement.includes("Build 265") || field.length !== 1)
  throw new Error("Current Block 7 authority must preserve the single deferred Navisworks 2025 field-evidence item and only the scheduled Build 265 provider boundary.");
if (!field[0].statement.includes("Navisworks 2025") || !field[0].statement.includes("Ruben"))
  throw new Error("Ruben's deferred physical Navisworks 2025 evidence item was not preserved.");
if (product.some((item) => item.ownership?.module !== "artifacts/bimlog/src/features/lens-next"))
  throw new Error("Any new current product work must remain explicitly owned by the Lens Next product boundary.");

console.log(`BUILD217_FINAL_RECONCILIATION=PASS P0=0 P1=${audit.counts.P1} unexpectedP1=0 currentProvider=${provider.length} fieldEvidence=1 currentProduct=${product.length} activeHistorical=${open.counts.ACTIVE - current.length}`);
