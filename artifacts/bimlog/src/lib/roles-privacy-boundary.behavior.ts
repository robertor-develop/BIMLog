import assert from "node:assert/strict";

import { ROLES, canEditConvention, canUpload } from "./roles";

const contractor = ROLES.sub_trade;

assert.equal(canUpload("sub_trade"), true);
assert.equal(canEditConvention("sub_trade"), false);
assert.match(contractor.description, /read authorized project information/i);
assert.match(contractor.description, /upload through Coordination Hub/i);
assert.match(contractor.description, /cannot make other project changes/i);
assert.match(contractor.descriptionEs, /consultar información autorizada del proyecto/i);
assert.match(contractor.descriptionEs, /subir archivos mediante Coordination Hub/i);
assert.match(contractor.descriptionEs, /no puede realizar otros cambios en el proyecto/i);
assert.doesNotMatch(contractor.description, /cannot view other modules/i);
assert.doesNotMatch(contractor.descriptionEs, /no puede ver otros módulos/i);

console.log("BM11 contractor guidance matches the read-plus-coordination-upload authority boundary: PASS");
