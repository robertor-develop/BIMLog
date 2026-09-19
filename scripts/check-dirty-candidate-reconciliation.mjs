import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/DIRTY_CANDIDATE_RECONCILIATION.json", "utf8"));
const allowed = new Set(["MAP_TO_PROGRAM", "SUPERSEDE", "EVIDENCE_ONLY"]);
if (data.destructiveActionAuthorized !== false) throw new Error("dirty-candidate reconciliation must prohibit destructive action");
if (!Array.isArray(data.candidates) || data.candidates.length !== 5) throw new Error("five candidate families are required");
for (const candidate of data.candidates) {
  if (!candidate.id || !candidate.effectiveBehavior || !candidate.cleanCandidateLocation || !candidate.reason) throw new Error(`incomplete candidate ${candidate.id ?? "UNKNOWN"}`);
  if (!allowed.has(candidate.disposition)) throw new Error(`invalid disposition for ${candidate.id}`);
  if (!candidate.targetBuilds) throw new Error(`missing target build for ${candidate.id}`);
}
console.log(JSON.stringify({ status: "PASS", candidateFamilies: data.candidates.length, dispositions: Object.fromEntries([...allowed].map((key) => [key, data.candidates.filter((item) => item.disposition === key).length])) }));
