import assert from "node:assert/strict";
import fs from "node:fs";

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

const page = read("artifacts/bimlog/src/pages/project/RfisTab.tsx");
const listState = read("artifacts/bimlog/src/pages/project/rfi-frontend/rfi-list-state.ts");
const editorState = read("artifacts/bimlog/src/pages/project/rfi-frontend/rfi-editor-state.ts");
const actions = read("artifacts/bimlog/src/pages/project/rfi-frontend/rfi-action-presentation.ts");

for (const modulePath of ["./rfi-frontend/rfi-list-state", "./rfi-frontend/rfi-editor-state", "./rfi-frontend/rfi-action-presentation"]) {
  assert.match(page, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${modulePath} remains wired into RfisTab`);
}
assert.match(page, /useRfiListState\(\{[\s\S]*rfis,[\s\S]*getStatusLabel:[\s\S]*typeOptions:/, "list/query state remains composed by the page");
assert.match(page, /useRfiCreateEvidenceState\(\)/, "create evidence state remains composed by the page");

for (const filterContract of ["statusFilter", "typeFilter", "ballInCourtFilter", "sentToCompanyFilter", "dateFrom", "dateTo", "search"]) {
  assert.match(listState, new RegExp(filterContract), `${filterContract} remains governed by the list state module`);
}
for (const queryKey of ["rfi_type", "ball_in_court", "sent_to_company", "date_field", "date_from", "date_to", "disposition"]) {
  assert.match(listState, new RegExp(`(?:\\b${queryKey}\\b|\"${queryKey}\")`), `${queryKey} remains in governed export query composition`);
}
assert.match(listState, /rfi\.sendStatus !== "sent" && !rfi\.sentAt/, "unsent RFIs remain with their author");
assert.match(listState, /rfi\.ballInCourt\?\.trim\(\)/, "stored responsibility remains authoritative");
assert.match(listState, /localeCompare\(right\.number[\s\S]*numeric: true/, "RFI number sort remains numeric-aware");

for (const state of ["fileSearch", "references", "attachments", "packageItems", "imagePresentation", "pendingImage", "pendingImageQueue", "capturedFrame", "uploadResults", "uploadingAtt"]) {
  assert.match(editorState, new RegExp(`\\[${state}, set${state[0].toUpperCase()}${state.slice(1)}\\]`), `${state} remains explicit editor state`);
}
assert.match(editorState, /sourceKind\?: "viewpoint" \| "upload" \| "paste" \| "screen-snip"/, "all governed image sources remain represented");
assert.match(editorState, /state: "uploading" \| "success" \| "error"/, "upload lifecycle remains fail-visible");

assert.match(actions, /recordState === "new"[\s\S]*createActions/, "new records keep their bounded create actions");
assert.match(actions, /recordState === "closed" && permissions\.canReopen/, "closed edit mode requires reopen permission");
assert.match(actions, /permissions\.canExport/, "export actions remain permission-gated");
assert.match(actions, /else if \(permissions\.canClose\)/, "close remains permission-gated");
assert.match(actions, /if \(permissions\.canRespond\)/, "response remains permission-gated");
assert.match(actions, /else if \(isProjectAdmin\)[\s\S]*key: "close"/, "saved open RFIs remain closable only by project administrators");
assert.doesNotMatch(actions, /if \(canWrite\)[\s\S]{0,80}key: "close"/, "generic write permission never grants close authority");

assert.match(page, /new URLSearchParams\(window\.location\.search\)/, "deep links remain parsed from the current URL");
assert.match(page, /const rfiParam = sp\.get\("rfi"\)/, "RFI identity deep link remains supported");
assert.match(page, /fetch\(`\/api\/v1\/projects\/\$\{projectId\}\/rfis\/\$\{rfiId\}`,[\s\S]*Authorization: `Bearer \$\{token\}`/, "deep-link lookup stays project-scoped and authenticated");
assert.match(page, /returnTab === "meetings" && meetingDraft/, "meeting-draft return context remains preserved");
assert.match(page, /if \(note \|\| trade \|\| floor \|\| ref\)[\s\S]*setCreatePreload[\s\S]*setShowCreate\(true\)/, "Lens and coordination prefill links remain functional");
assert.match(page, /Could not open that RFI\.[\s\S]*variant: "destructive"/, "failed identity links remain visible to the user");

const pageLines = page.split(/\r?\n/).length;
assert.ok(pageLines < 4000, `RfisTab decomposition must stay below 4000 lines; received ${pageLines}`);

console.log(`POST120_BLOCK31=PASS lines=${pageLines} list=isolated editor=isolated roles=guarded deeplinks=covered`);
