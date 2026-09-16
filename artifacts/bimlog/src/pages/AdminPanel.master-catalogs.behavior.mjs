import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
const companyPage = fs.readFileSync(new URL("./CompanyMasterCatalogs.tsx", import.meta.url), "utf8");
const companyTab = fs.readFileSync(new URL("../components/admin/CompanyMasterCatalogsTab.tsx", import.meta.url), "utf8");

assert.match(source, /"Master Catalogs"/, "super-admin navigation must expose master catalogs");
assert.match(source, /\/master-catalogs\/\$\{kind\}\?scope=global&includeInactive=true/, "global catalog administration must load active and inactive entries without company overrides");
assert.match(source, /\/admin\/master-catalogs\/\$\{kind\}/, "catalog creation must use the governed super-admin route");
assert.match(source, /\/admin\/master-catalogs\/\$\{kind\}\/\$\{entry\.id\}/, "catalog lifecycle changes must use the governed versioned entry route");
assert.match(source, /Clients are managed in Companies/, "the existing client authority must remain explicit");
assert.match(source, /disciplines in the existing enterprise authority/, "the existing discipline authority must remain explicit");
assert.doesNotMatch(source, /method:\s*"DELETE"[^]*master-catalogs/, "master catalogs must never expose destructive deletion");
assert.match(app, /path="\/company-catalogs"[^]*ProtectedRoute component=\{CompanyMasterCatalogs\}/, "company catalogs need an authenticated route independent of project administration");
assert.match(sidebar, /\/company\/master-catalogs\/capabilities[^]*setShowCompanyCatalogs\(capability\.canManage === true\)/, "company catalog navigation must follow server PMO capability");
assert.match(sidebar, /showCompanyCatalogs && navButton\([^]*"\/company-catalogs"/, "PMO users need an entry point without project-admin authority");
assert.match(companyPage, /<CompanyMasterCatalogsTab token=\{token\} spanish=\{spanish\}/, "the dedicated route must reuse the production catalog component");
assert.match(companyTab, /const ready = capability !== null && !loading && !loadError/, "stale catalog controls must be hidden after failed reload");
assert.match(companyTab, /role="alert"[^]*Reintentar/, "load errors must be visible and retryable");

console.log("Admin master catalog behavior: PASS");
