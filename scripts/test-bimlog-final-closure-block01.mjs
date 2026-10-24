import assert from "node:assert/strict";
import fs from "node:fs";
import { validateLorenaEvidenceLedger } from "./lib/lorena-evidence-integrity.mjs";

const ledger = JSON.parse(fs.readFileSync("evidence/outcome-remediation-20261023/lorena-final-evidence-ledger.json", "utf8"));
const candidate = ledger.candidate.sourceCommit;
const integrityErrors = validateLorenaEvidenceLedger(ledger, { candidateCommit: candidate });
assert.deepEqual(integrityErrors, ["MIXED_PROJECT_LIFECYCLE_EVIDENCE"], "current ledger must expose the known mixed-project evidence gap");

const acceptanceErrors = validateLorenaEvidenceLedger(ledger, { candidateCommit: candidate, requireIndependent: true });
assert.ok(acceptanceErrors.includes("MIXED_PROJECT_LIFECYCLE_EVIDENCE"));
assert.equal(acceptanceErrors.filter((value) => value.endsWith(":INDEPENDENT_REVIEW_REQUIRED")).length, 10);
assert.equal(ledger.claims.some((claim) => claim.state === "INDEPENDENTLY_ACCEPTED" || claim.state === "CUSTOMER_FIELD_ACCEPTED"), false);

const matrix = fs.readFileSync("evidence/outcome-remediation-20261023/LORENA_FINAL_ACCEPTANCE.md", "utf8");
assert.doesNotMatch(matrix, /\|\s*(?:PASS|ACCEPTED|INDEPENDENTLY_ACCEPTED|CUSTOMER_ACCEPTED)\s*\|/i);
assert.match(matrix, /Source\/database state \| Live state \| Independent state \| Customer\/field state/);
console.log(`BIMLog final closure Block 1: PASS integrity; acceptance remains fail-closed (${acceptanceErrors.length} blockers)`);
