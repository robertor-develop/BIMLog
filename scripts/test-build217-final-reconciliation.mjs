import fs from "node:fs";
import { validateCurrentOpenLoopAuthority } from "./current-open-loop-authority.mjs";

const audit = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/BUILD_216_PLATFORM_AUDIT.json", "utf8"));
const census = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/BUILD_216_REPOSITORY_CENSUS.json", "utf8"));
const open = JSON.parse(fs.readFileSync("living-brief/OPEN_LOOP_DISPOSITIONS.json", "utf8"));
const openLoop = fs.readFileSync("living-brief/OPEN_LOOP.md", "utf8");
const current = validateCurrentOpenLoopAuthority(open);
const provider = current.filter((item) => item.workClass === "PROVIDER_EVIDENCE");
const field = current.filter((item) => item.workClass === "FIELD_EVIDENCE");
const product = current.filter((item) => item.workClass === "PRODUCT_WORK");

if (census.status !== "PASS" || census.totals.trackedFiles < 1 || census.totals.sourceLines < 1)
  throw new Error("Build 216 repository census is missing or empty.");
if (audit.status !== "PASS" || audit.counts.P0 !== 0 || audit.baseline.unexpectedP1.length !== 0)
  throw new Error("Final audit contains a P0 or an unclassified P1 identity.");
if (!openLoop.includes("- [x] Roberto confirmed physical Navisworks 2025 acceptance on 2026-11-10."))
  throw new Error("Roberto's completed physical Navisworks 2025 acceptance evidence was not preserved.");

console.log(`BUILD217_FINAL_RECONCILIATION=PASS P0=0 P1=${audit.counts.P1} unexpectedP1=0 currentProvider=${provider.length} fieldEvidence=${field.length} currentProduct=${product.length} activeHistorical=${open.counts.ACTIVE - current.length}`);
