import assert from "node:assert/strict";
import fs from "node:fs";
import { validateLorenaEvidenceLedger } from "./lib/lorena-evidence-integrity.mjs";

const ledger = JSON.parse(fs.readFileSync("evidence/outcome-remediation-20261023/lorena-final-evidence-ledger.json", "utf8"));
const candidate = ledger.candidate.sourceCommit;
const errors = validateLorenaEvidenceLedger(ledger, { candidateCommit: candidate });
assert.ok(errors.includes("MIXED_PROJECT_LIFECYCLE_EVIDENCE"), "mixed-project lifecycle evidence must fail closed");

const stale = structuredClone(ledger);
stale.candidate.deployedCommit = "0".repeat(40);
assert.ok(validateLorenaEvidenceLedger(stale, { candidateCommit: candidate }).includes("DEPLOYED_IDENTITY_MISMATCH"));

const fixtureOnly = structuredClone(ledger);
fixtureOnly.claims[0].state = "FIXTURE_ONLY";
assert.ok(validateLorenaEvidenceLedger(fixtureOnly, { candidateCommit: candidate }).some((value) => value.includes("NON_ACCEPTANCE_EVIDENCE")));

const missingArtifact = structuredClone(ledger);
missingArtifact.claims.at(-1).artifactRefs = [];
assert.ok(validateLorenaEvidenceLedger(missingArtifact, { candidateCommit: candidate }).some((value) => value.includes("MISSING_ARTIFACT")));

console.log("Lorena evidence integrity negative cases: PASS");
