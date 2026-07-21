import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const checker = path.join(root, "scripts/check-living-brief.mjs");
const cases = [];

function fixture() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-living-brief-gate-"));
  fs.cpSync(path.join(root, "living-brief"), path.join(target, "living-brief"), { recursive: true });
  const requiredSources = [
    "artifacts/api-server/src/routes/living_brief.ts",
    "artifacts/api-server/scripts/generate-platform-md.ts",
    "artifacts/bimlog/src/pages/LivingBrief.tsx",
  ];
  for (const relative of requiredSources) {
    const output = path.join(target, relative);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(root, relative), output);
  }
  return target;
}

function run(cwd, env = {}) {
  return spawnSync(process.execPath, [checker], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function expectFailure(name, mutate, expected) {
  const target = fixture();
  try {
    mutate(target);
    const result = run(target);
    assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
    assert.match(`${result.stdout}\n${result.stderr}`, expected);
    cases.push(name);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

{
  const target = fixture();
  try {
    const result = run(target);
    assert.equal(result.status, 0, result.stderr);
    cases.push("production bundle without .git validates committed metadata");
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
}

{
  const target = fixture();
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(target, "living-brief/catalog.json"), "utf8"));
    for (const document of catalog.documents) {
      const file = path.join(target, "living-brief", document.file);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n"));
    }
    const result = run(target);
    assert.equal(result.status, 0, result.stderr);
    cases.push("canonical hashes survive LF production checkout");
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
}

expectFailure("missing document fails", (target) => {
  fs.rmSync(path.join(target, "living-brief/QUALITY.md"));
}, /required document is missing/);

expectFailure("missing UI catalog enumeration fails", (target) => {
  const file = path.join(target, "artifacts/bimlog/src/pages/LivingBrief.tsx");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("docs.map", "docs.filter(Boolean).map"));
}, /UI tabs must enumerate API catalog documents/);

expectFailure("stale reconciled-through marker fails", (target) => {
  const file = path.join(target, "living-brief/state.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  state.documents[0].reconciledThroughCommit = "0".repeat(40);
  fs.writeFileSync(file, JSON.stringify(state));
}, /stale reconciled-through marker/);

expectFailure("source hash mismatch fails", (target) => {
  fs.appendFileSync(path.join(target, "living-brief/VISION.md"), "\nchanged without reconciliation\n");
}, /content SHA-256 does not match state.json/);

expectFailure("future claim fails", (target) => {
  const file = path.join(target, "living-brief/state.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  state.documents[0].sourceChangedAt = "2999-01-01T00:00:00.000Z";
  fs.writeFileSync(file, JSON.stringify(state));
}, /future sourceChangedAt/);

{
  const target = fixture();
  try {
    const snapshot = path.join(target, "mirror.json");
    const catalog = JSON.parse(fs.readFileSync(path.join(target, "living-brief/catalog.json"), "utf8"));
    const state = JSON.parse(fs.readFileSync(path.join(target, "living-brief/state.json"), "utf8"));
    const byKey = new Map(state.documents.map((document) => [document.key, document]));
    const rows = Object.fromEntries(catalog.documents.map((document) => [document.key, { sourceSha256: byKey.get(document.key).sha256 }]));
    rows[catalog.documents[0].key].sourceSha256 = "f".repeat(64);
    rows.unknown_doctrine = { sourceSha256: "0".repeat(64) };
    fs.writeFileSync(snapshot, JSON.stringify(rows));
    const result = run(target, { LIVING_BRIEF_MIRROR_SNAPSHOT: snapshot });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /unknown database document key/);
    assert.match(`${result.stdout}\n${result.stderr}`, /source\/mirror hash mismatch/);
    cases.push("unknown key and mirror mismatch fail");
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
}

{
  const result = run(root, { LIVING_BRIEF_TEST_HEAD: "447ea95e8f389ea1600cc2c834ab273354cf4f8d" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /is not an ancestor/);
  cases.push("invalid nonancestor commit fails when Git is available");
}

console.log(`Living Brief freshness matrix passed: ${cases.length}/${cases.length}`);
for (const value of cases) console.log(`- ${value}`);
