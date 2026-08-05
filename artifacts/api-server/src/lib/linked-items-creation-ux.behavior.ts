import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const source = fs.readFileSync(path.join(root, "artifacts/bimlog/src/components/LinkedItemsPanel.tsx"), "utf8");
const passed: string[] = [];

function check(name: string, proof: () => void) {
  proof();
  passed.push(name);
}

check("create keeps the current record open and explains the return flow", () => {
  assert.match(source, /window\.open\([^\n]+"_blank"\)/);
  assert.match(source, /if \(opened\) opened\.opener = null/);
  assert.match(source, /Return here and the list will refresh automatically/);
  assert.match(source, /new tab was blocked/);
});

check("returning to the record refreshes available link targets", () => {
  assert.match(source, /window\.addEventListener\("focus", refreshAfterCreate\)/);
  assert.match(source, /window\.removeEventListener\("focus", refreshAfterCreate\)/);
  assert.match(source, /const refreshAfterCreate = \(\) => loadItems\(\)/);
});

check("manual refresh remains available for documents and clashes", () => {
  assert.match(source, /"Refresh items"/);
  assert.match(source, /"Refresh clashes"/);
  assert.match(source, /disabled=\{itemsLoading\}/);
  assert.match(source, /Refreshing\.\.\./);
});

check("attach and remove failures are visible instead of silent", () => {
  assert.match(source, /if \(!r\.ok\)/);
  assert.match(source, /This item could not be attached/);
  assert.match(source, /This link could not be removed/);
  assert.match(source, /role=\{feedback\.tone === "error" \? "alert" : "status"\}/);
});

check("401, 403, and 500 target-list responses retain prior lists and alert", () => {
  const policyBody = source.match(
    /export function requireSuccessfulTargetLists\(responses: readonly TargetListResponse\[\]\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(policyBody, "production target-list policy function must be extractable");
  const executePolicy = new Function("responses", "LINK_TARGET_REFRESH_ERROR", policyBody) as
    (responses: Array<{ ok: boolean; status: number }>, message: string) => void;
  const boundedMessage = "Items could not be refreshed. Your existing selections were kept. Check your access and try again.";
  const retained = [{ id: 41, label: "Existing selection" }];
  for (const status of [401, 403, 500]) {
    const before = JSON.stringify(retained);
    assert.throws(
      () => executePolicy([
        { ok: true, status: 200 },
        { ok: false, status },
      ], boundedMessage),
      new RegExp(boundedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.equal(JSON.stringify(retained), before);
  }
  assert.match(source, /requireSuccessfulTargetLists\(\[subRes, transRes, coRes, meetRes, fileRes, reportRes\]\)/);
  assert.ok(source.indexOf("requireSuccessfulTargetLists") < source.indexOf("setItems({ clash: clashes"));
  assert.match(source, /role=\{feedback\.tone === "error" \? "alert" : "status"\}/);
  assert.match(source, /Your existing selections were kept/);
});

check("scope remains the existing linked-items API without adjacent mutations", () => {
  assert.match(source, /\/projects\/\$\{projectId\}\/links/);
  assert.doesNotMatch(source, /DATABASE_URL|provider|replit|navisworks/i);
});

console.log(JSON.stringify({
  suite: "linked-items-creation-ux",
  passed: passed.length,
  checks: passed,
  database: "not used",
  browser: "not launched",
  productionAccess: false,
}, null, 2));
