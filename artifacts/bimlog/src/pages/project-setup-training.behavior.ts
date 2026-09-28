import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./ProjectSetupTraining.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const accessibility = readFileSync(new URL("../components/layout/RouteAccessibility.tsx", import.meta.url), "utf8");
assert.match(app, /ProjectSetupTraining/);
assert.match(app, /path="\/training\/project-setup"/);
assert.match(accessibility, /"\/training\/project-setup": "BIMLog Project Setup Training"/);
assert.match(page, /data-training-classification="synthetic"/);
assert.match(page, /does not create, approve, publish, activate, or modify/);
assert.match(page, /No autoapproval/);
assert.match(page, /changes no Lens Native binaries, installers, or Ruben's workstation/);
assert.doesNotMatch(page, /fetch\(|axios|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
assert.doesNotMatch(page, /127\.0\.0\.1|8766|Navisworks\.exe|BIMLogNavisPlugin/);
console.log("C025 synthetic actual-UI training workspace: PASS");
