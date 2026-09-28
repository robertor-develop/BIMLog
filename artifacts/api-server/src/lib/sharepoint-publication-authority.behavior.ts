import assert from "node:assert/strict";
import { requireSharePointPublicationAuthority } from "./sharepoint-publication-authority";
assert.doesNotThrow(() => requireSharePointPublicationAuthority({ companyId: 31, projectId: 26, actorCompanyId: 31, actorProjectIds: [26], canPublish: true }));
for (const input of [{ companyId: 31, projectId: 26, actorCompanyId: 35, actorProjectIds: [26], canPublish: true }, { companyId: 31, projectId: 26, actorCompanyId: 31, actorProjectIds: [27], canPublish: true }, { companyId: 31, projectId: 26, actorCompanyId: 31, actorProjectIds: [26], canPublish: false }]) assert.throws(() => requireSharePointPublicationAuthority(input), /PUBLISH_FORBIDDEN/);
