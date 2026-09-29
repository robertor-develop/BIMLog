import assert from "node:assert/strict"; import {EVIDENCE_HISTORY_SOURCES,evidenceHistoryHref} from "./report-experience.ts";
assert.equal(EVIDENCE_HISTORY_SOURCES.length,6); assert.equal(new Set(EVIDENCE_HISTORY_SOURCES.map(x=>x.authority)).size,6); assert.match(decodeURIComponent(evidenceHistoryHref(35,"rfis")),/\/projects\/35\/reports/);
console.log("PASS UX069 navigable cross-record evidence histories");
