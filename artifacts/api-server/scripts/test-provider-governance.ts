import assert from "node:assert/strict";
import {
  customerProviderCatalog,
  isLegacyAutodeskAllowed,
  isProviderOperationAllowed,
} from "../src/lib/provider-governance";

const configured = () => true;

assert.equal(isProviderOperationAllowed("google_drive", 17, "authorize", ""), true);
assert.equal(isProviderOperationAllowed("dropbox", 17, "import", ""), true);
assert.equal(isProviderOperationAllowed("procore", 17, "authorize", ""), false);
assert.equal(isProviderOperationAllowed("bim360", 17, "callback", ""), false);
assert.equal(isProviderOperationAllowed("speckle", 17, "catalog", ""), false);
assert.equal(isLegacyAutodeskAllowed(""), false);

const approvals = "17:speckle:catalog,17:procore:*,*:legacy_autodesk:legacy";
assert.equal(isProviderOperationAllowed("speckle", 17, "catalog", approvals), true);
assert.equal(isProviderOperationAllowed("speckle", 18, "catalog", approvals), false);
assert.equal(isProviderOperationAllowed("procore", 17, "browse", approvals), true);
assert.equal(isProviderOperationAllowed("procore", 18, "browse", approvals), false);
assert.equal(isLegacyAutodeskAllowed(approvals), true);

const defaultCatalog = customerProviderCatalog(17, configured, "");
assert.deepEqual(
  defaultCatalog.map((provider) => provider.key),
  ["ifc_openbim", "document_exchange", "navisworks_lens", "google_drive", "dropbox"],
);
assert.equal(JSON.stringify(defaultCatalog).includes("visibility"), false);
assert.equal(JSON.stringify(defaultCatalog).includes("threat"), false);
assert.equal(JSON.stringify(defaultCatalog).includes("credential"), false);

const unconfiguredCatalog = customerProviderCatalog(17, () => false, "");
assert.equal(
  unconfiguredCatalog.find((provider) => provider.key === "google_drive")?.availability,
  "setup_required",
);

console.log("provider governance authorization and disclosure checks passed");
