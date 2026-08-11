import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeInvitationEmail,
  resolveInvitationCompanyId,
} from "./project-invitation-contract";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) =>
  fs.readFileSync(path.resolve(here, relative), "utf8");

assert.equal(
  normalizeInvitationEmail("  Lorena@BIMTECH.example "),
  "lorena@bimtech.example",
);
assert.equal(
  resolveInvitationCompanyId([7, 7, null]),
  7,
  "multiple project invitations from one company must resolve to one canonical company",
);
assert.equal(
  resolveInvitationCompanyId([null, undefined]),
  null,
  "ordinary registration remains available without an invitation binding",
);
assert.throws(
  () => resolveInvitationCompanyId([7, 8]),
  /conflicting companies/,
);

const migration = read("./project-invitation-migration.ts");
const auth = read("../routes/auth.ts");
const members = read("../routes/members.ts");
const directory = read("../routes/project_directory.ts");
const service = read("./project-invitation-service.ts");
const register = read("../../../bimlog/src/pages/Register.tsx");
const team = read("../../../bimlog/src/pages/project/TeamTab.tsx");
assert.doesNotMatch(
  migration,
  /\bDROP\s+(?:TABLE|COLUMN|CONSTRAINT)\b/i,
  "invitation migration must remain additive",
);
assert.match(migration, /ADD COLUMN IF NOT EXISTS company_id/);
assert.match(migration, /SET company_id = inviter\.company_id/);
assert.match(auth, /db\.transaction/);
assert.match(auth, /acceptedProjectIds/);
assert.match(auth, /lower\(trim\(/);
assert.match(auth, /pg_advisory_xact_lock/);
assert.match(auth, /invitationEmailLockKey\(email\)/);
assert.match(service, /kind: "existing"/);
assert.match(service, /companyId: inviter\[0\]\.companyId/);
assert.match(service, /pg_advisory_xact_lock/);
assert.match(service, /invitationEmailLockKey\(email\)/);
assert.match(members, /inviteOrAddProjectMember/);
assert.match(directory, /inviteOrAddProjectMember/);
assert.match(directory, /makeInvitationEmail/);
assert.match(directory, /Membership notification email failed/);
assert.doesNotMatch(directory, /insert\(projectInvitations\)/);
assert.match(register, /new URLSearchParams\(window\.location\.search\)/);
assert.match(team, /joins them to your company and this project automatically/);
assert.match(team, /Invitaciones pendientes/);
assert.match(team, /No se pudo cancelar la invitación/);
assert.match(members, /set\(\{ status: "cancelled" \}\)/);
assert.doesNotMatch(members, /delete\(projectInvitations\)/);
assert.match(register, /Cree su cuenta/);

console.log(
  JSON.stringify({
    status: "PASS",
    tests: [
      "email-normalization",
      "canonical-company-binding",
      "conflict-refusal",
      "additive-migration",
      "transactional-registration",
      "existing-user-direct-membership",
      "invited-registration-ui",
    ],
  }),
);
