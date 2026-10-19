import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const gates=[
  ["scripts/test-ga-final-block04-build030-integration-verification.mjs",/BOUNDED PASS.*UNTESTED/],
  ["scripts/test-ga-final-block05-build031-security-isolation.mjs",/GA-F05-B031 PASS: authenticated mounted HTTP\/database/],
  ["scripts/test-ga-final-block05-build032-mobile-accessibility.mjs",/GA-F05-B032 PASS: exact responsive route matrix/],
  ["scripts/test-ga-final-block05-build033-failure-recovery.mjs",/GA-F05-B033 PASS: retry, rollback/]
];
for(const [file,truth] of gates){const r=spawnSync(process.execPath,[file],{encoding:"utf8"});assert.equal(r.status,0,`${file}\n${r.stdout}\n${r.stderr}`);assert.match(r.stdout,truth);assert.doesNotMatch(r.stdout,/exact 390x844.*PASS|matrix: PASS \(18\/18\)|live provider.*PASS/i);}
console.log("CORRECTIVE-B03 behavioral gate truth PASS: executable failures run; static/rendered/live gaps remain UNTESTED");
