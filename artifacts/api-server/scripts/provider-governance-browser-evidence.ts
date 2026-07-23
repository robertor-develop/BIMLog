import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "../../bimlog/src");
const read = (relative: string) => readFile(path.join(appRoot, relative), "utf8");

const [catalogPage, sidebar, modal, profile, privacy] = await Promise.all([
  read("pages/project/IntegrationsTab.tsx"),
  read("components/layout/ProjectSidebar.tsx"),
  read("components/IntegrationModal.tsx"),
  read("pages/Profile.tsx"),
  read("pages/Privacy.tsx"),
]);

assert.match(catalogPage, /\/api\/v1\/me\/provider-catalog/);
assert.doesNotMatch(catalogPage, /Procore|Autodesk|BIM 360|Aconex|Trimble/);
assert.doesNotMatch(sidebar, /Procore|Autodesk|BIM 360|Managed Connection|API Platform Integrations/);
assert.doesNotMatch(modal, /type="password"|API Token:|Username:|Password:|mailto:/);
assert.match(modal, /Never submit passwords, API keys, or access tokens/);
assert.match(profile, /governedProviders\.map/);
assert.doesNotMatch(profile, /label:\s*"Procore"|label:\s*"BIM 360/);
assert.doesNotMatch(privacy, /does not permanently store physical project files/i);
assert.doesNotMatch(privacy, /No almacenamos archivos físicos de proyecto/);

console.log("customer-facing provider discovery and privacy browser contract passed");
