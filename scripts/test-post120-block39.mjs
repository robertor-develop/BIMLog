import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/LENS_NEXT_FIELD_EVIDENCE.json", "utf8"));
const installer = fs.readFileSync("plugins/BIMLogLensNext/Install-BIMLogLensNext.ps1", "utf8");
const canonicalBuilder = fs.readFileSync("plugins/BIMLogLensNext/Build-CanonicalLensNextPackages.ps1", "utf8");

assert.equal(evidence.release, "v1.05.N18-P36");
assert.equal(evidence.rubenPhysical2025.status, "DEFERRED_TO_RUBEN");
assert.equal(evidence.rubenPhysical2025.resultIngested, false);
assert.equal(evidence.rubenPhysical2025.reopensBuild119, false);
assert.equal(evidence.installed2021.retiredDirectLoad.containsRetiredLensPanel, true);
assert.equal(evidence.installed2021.retiredDirectLoad.state, "REMOVED_WITH_ROLLBACK_EVIDENCE");
assert.equal(evidence.installed2021.retiredDirectLoad.activeAfterCutover, false);
assert.match(installer, /Navisworks Manage \$Year\\Plugins\\BIMLogNavisPlugin/);
assert.match(installer, /retired direct-load Original Lens plugin remains active/);
assert.match(canonicalBuilder, /\$isPulseBinary/);

assert.deepEqual(evidence.packageCandidates.map(item => item.year), [2021, 2025]);
for (const candidate of evidence.packageCandidates) {
  assert.match(candidate.zipSha256, /^[A-F0-9]{64}$/);
  assert.match(candidate.manifestSha256, /^[A-F0-9]{64}$/);
  assert.match(candidate.pulseDllSha256, /^[A-F0-9]{64}$/);
  assert.equal(candidate.deterministicRebuild, true);
  assert.equal(candidate.upgradeRollbackSimulation, "PASS");
  assert.equal(candidate.retiredDirectLoadAfterSimulation, false);
  assert.deepEqual(candidate.activeTopologyAfterSimulation, ["BIMLog.bundle", `BIMLogLensNext${candidate.year}.bundle`]);
}

for (const result of Object.values(evidence.workflowAndRollback))
  assert.ok(result === "PASS" || result === "DEFERRED_TO_RUBEN" || result === "PASS_PULSE_AND_LENS_NEXT_ONLY");

console.log("POST120_BLOCK39=PASS years=2021,2025 physical2021=closed physical2025=deferred-to-ruben");
