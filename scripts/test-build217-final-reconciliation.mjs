import fs from "node:fs";

const audit = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/BUILD_216_PLATFORM_AUDIT.json", "utf8"));
const census = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/BUILD_216_REPOSITORY_CENSUS.json", "utf8"));
const open = JSON.parse(fs.readFileSync("living-brief/OPEN_LOOP_DISPOSITIONS.json", "utf8"));
const current = open.items.filter((item) => item.currentAuthority && item.classification === "ACTIVE");
const provider = current.filter((item) => item.workClass === "PROVIDER_EVIDENCE");
const field = current.filter((item) => item.workClass === "FIELD_EVIDENCE");

if (census.status !== "PASS" || census.totals.trackedFiles < 1 || census.totals.sourceLines < 1)
  throw new Error("Build 216 repository census is missing or empty.");
if (audit.status !== "PASS" || audit.counts.P0 !== 0 || audit.baseline.unexpectedP1.length !== 0)
  throw new Error("Final audit contains a P0 or an unclassified P1 identity.");
if (current.length !== 2 || provider.length !== 0 || field.length !== 2)
  throw new Error("Current open-loop authority must contain only the two field-evidence items after Build 220 provider closure.");
if (!field.some((item) => item.statement.includes("Navisworks 2021")) || !field.some((item) => item.statement.includes("Navisworks 2025")))
  throw new Error("The two independent physical Navisworks evidence items were not preserved.");

console.log(`BUILD217_FINAL_RECONCILIATION=PASS P0=0 P1=${audit.counts.P1} unexpectedP1=0 currentProvider=0 fieldEvidence=2 activeHistorical=${open.counts.ACTIVE - current.length}`);
