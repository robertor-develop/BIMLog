import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative) =>
  fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

const builder = read("artifacts/bimlog/src/pages/project/ConventionBuilder.tsx");
const documentState = read("artifacts/bimlog/src/pages/project/convention-builder/convention-document-state.ts");
const navigation = read("artifacts/bimlog/src/pages/project/convention-builder/convention-navigation.ts");
const assignment = read("artifacts/bimlog/src/pages/project/convention-builder/ConventionPartyAssignment.tsx");
const catalog = read("artifacts/bimlog/src/pages/project/convention-builder/convention-clause-catalog.ts");

for (const modulePath of [
  "./convention-builder/convention-document-state",
  "./convention-builder/convention-navigation",
  "./convention-builder/ConventionPartyAssignment",
  "./convention-builder/convention-clause-catalog",
]) {
  assert.match(builder, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const validation of [
  "company_required",
  "company_code_required",
  "company_code_duplicate",
  "discipline_required",
  "level_required",
  "document_type_required",
  "status_required",
  "revision_required",
]) {
  assert.match(documentState, new RegExp(`errors\\.push\\(\"${validation}\"\\)`));
}
assert.match(documentState, /code\.trim\(\)\.toUpperCase\(\)/, "saved codes remain normalized");
assert.match(documentState, /new Set\(companyCodes\)\.size !== companyCodes\.length/, "duplicate company codes fail closed");
assert.match(documentState, /markCompleted: true/, "valid saves retain completion semantics");
assert.match(documentState, /userGuidance \? \{ userGuidance: state\.userGuidance \} : \{\}/);
assert.match(documentState, /companyCodes: Array\.isArray\(projectCode\?\.allowedValues\)/, "saved parties reload from persisted fields");
assert.match(documentState, /setupStatus === "completed" && foundation\.levelCodes !== null && foundation\.levelCodes\.length === 0/, "empty saved levels remain repairable rather than defaulted");

assert.match(navigation, /analysisOnlyMode[\s\S]*builderIntent === "analyze_existing"[\s\S]*setupContextChoice === "takeover"/);
assert.match(navigation, /projectEnvironment === "industrial_epc"/);
assert.match(navigation, /return "main_wizard"/);
assert.match(navigation, /hasExisting[\s\S]*flowPhase: "main_wizard", step: 4/);
assert.match(navigation, /enteredFromDiscovery && hasDiscoveryResult \? "ai_suggestions" : "setup_context"/);
assert.match(navigation, /setupStatus !== "completed" && phaseRequiresCompletedConvention\(flowPhase\)/);

const phaseGuardIndex = builder.indexOf("useConventionPhaseGuard({");
const loadingGuardIndex = builder.indexOf("if (isLoading) return");
assert.ok(phaseGuardIndex > 0 && loadingGuardIndex > phaseGuardIndex, "phase guard must remain before loading/error returns");
assert.match(builder, /validateConventionDocumentState\(ws\)[\s\S]*if \(!validation\.valid\)[\s\S]*return;[\s\S]*buildConventionDocumentPayload\(ws\)/);
assert.match(builder, /if \(isError\)[\s\S]*Failed to load convention data[\s\S]*Retry/);
assert.match(builder, /if \(!isAdmin\)/, "non-admin read-only denial remains present");
assert.doesNotMatch(builder, /function CompanyAssignmentBlock/, "party assignment must not drift back into the page");

assert.match(assignment, /\/api\/v1\/projects\/\$\{projectId\}\/assign-company-user/);
assert.match(assignment, /Authorization: `Bearer \$\{token\}`/);
assert.match(assignment, /companyCode: assignCode[\s\S]*fullName: fullName\.trim\(\)[\s\S]*email: email\.trim\(\)\.toLowerCase\(\)[\s\S]*companyName: companyName\.trim\(\)/);
assert.match(assignment, /disabled=\{item\.hasUsers\}/, "assigned parties cannot be resubmitted");
assert.equal((assignment.match(/aria-label=/g) || []).length, 4, "party action and all three fields remain labeled");
assert.match(assignment, /role="alert"/);
assert.match(assignment, /finally[\s\S]*setSubmitting\(false\)/, "submission state recovers after every result");

for (const category of ["Cost & Quantity", "Contracts & Legal"]) assert.match(catalog, new RegExp(category.replace("&", "&")));
const codes = [...catalog.matchAll(/\{ code: "([A-Z0-9]+)"/g)].map(match => match[1]);
assert.equal(codes.length, 27, "financial and contract catalogs preserve all 27 definitions");
assert.equal(new Set(codes).size, codes.length, "financial and contract codes remain unique");

console.log("POST120_BLOCK30=PASS persistence=guarded navigation=stable assignment=accessible catalog=complete");
