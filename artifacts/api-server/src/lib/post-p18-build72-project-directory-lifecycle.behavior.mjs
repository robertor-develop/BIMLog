import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../routes/project_directory.ts", import.meta.url),
  "utf8",
);
const invitationService = fs.readFileSync(
  new URL("./project-invitation-service.ts", import.meta.url),
  "utf8",
);

const companyRoute = route.match(
  /router\.post\(\s*"\/projects\/:projectId\/directory\/companies"[\s\S]*?\n\s*\},\s*\n\s*\);/,
)?.[0];
assert.ok(companyRoute, "company route must exist");
assert.match(companyRoute, /normalizeCompanyName/);
assert.match(companyRoute, /company_name_required/);
assert.match(companyRoute, /company_name_too_long/);
assert.match(companyRoute, /pg_advisory_xact_lock/);
assert.match(companyRoute, /canonical-company:/);
assert.match(companyRoute, /projectDirectoryTable\.projectId, projectId/);
assert.match(companyRoute, /projectDirectoryTable\.companyId, company\.id/);
assert.match(companyRoute, /directoryEntryReused: true/);
assert.match(companyRoute, /directoryEntryReused: false/);
assert.match(companyRoute, /status\(result\.directoryEntryReused \? 200 : 201\)/);

const contactRoute = route.match(
  /router\.post\(\s*"\/projects\/:projectId\/directory\/contacts"[\s\S]*?\n\s*\},\s*\n\s*\);/,
)?.[0];
assert.ok(contactRoute, "contact route must exist");
assert.match(contactRoute, /full_name_required/);
assert.match(contactRoute, /company_id_required/);
assert.match(contactRoute, /projectDirectoryTable\.projectId, projectId/);
assert.match(contactRoute, /projectDirectoryTable\.companyId, companyId/);
assert.match(contactRoute, /project-directory-contact:/);
assert.match(contactRoute, /lower\(\$\{projectDirectoryTable\.email\}\) = \$\{email\}/);
assert.match(contactRoute, /return \{ entry: existing, reused: true \}/);
assert.match(contactRoute, /return \{ entry: created, reused: false \}/);
assert.match(contactRoute, /status\(entry\.reused \? 200 : 201\)/);

assert.match(invitationService, /normalizeInvitationEmail\(input\.email\)/);
assert.match(invitationService, /projectInvitationLockKey\(input\.projectId, email\)/);
assert.match(invitationService, /projectMembersTable\.projectId, input\.projectId/);
assert.match(invitationService, /projectInvitations\.projectId, input\.projectId/);
assert.match(invitationService, /eq\(projectInvitations\.status, "pending"\)/);
assert.match(invitationService, /alreadyMember: Boolean\(existingMember\[0\]\)/);

console.log("POST-P18 Build 72 Project Directory lifecycle: PASS");
