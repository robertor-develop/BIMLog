import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative) =>
  fs.readFileSync(new URL(relative, import.meta.url), "utf8");

const directory = read("../routes/project_directory.ts");
const meetings = read("../routes/meeting_minutes.ts");
const intake = read("./job-intake-service.ts");
const members = read("../routes/members.ts");
const rfis = read("../routes/rfis.ts");
const submittals = read("../routes/submittals.ts");
const schema = read("../../../../lib/db/src/schema/meeting-minutes.ts");

const removeRoute = directory.match(
  /router\.delete\(\s*"\/projects\/:projectId\/directory\/:entryId"[\s\S]*?\n\s*\},\s*\n\s*\);/,
)?.[0];
assert.ok(removeRoute, "Directory removal route must exist");
assert.match(removeRoute, /select\(\{ id: projectDirectoryTable\.id \}\)/);
assert.match(removeRoute, /status\(404\)\.json\(\{ error: "Entry not found" \}\)/);
assert.match(removeRoute, /meetingAttendeesTable\.directoryEntryId, entryId/);
assert.match(removeRoute, /status\(409\)\.json\(\{ error: "directory_entry_in_use" \}\)/);
assert.match(
  removeRoute,
  /eq\(projectDirectoryTable\.id, entryId\)[\s\S]*eq\(projectDirectoryTable\.projectId, projectId\)/,
);

assert.match(schema, /foreignColumns: \[projectDirectoryTable\.id\]/);
assert.doesNotMatch(
  schema.match(/meeting_attendees[\s\S]*?\n\);/)?.[0] || "",
  /onDelete:\s*"cascade"/,
  "Meeting attendance must not cascade away when a Directory record is removed",
);

assert.match(meetings, /validateAttendeeCompanyAccess/);
assert.match(meetings, /projectDirectoryTable\.projectId, projectId/);
assert.match(meetings, /projectDirectoryTable\.companyId, companyId/);
assert.match(meetings, /validateAttendeeDirectoryEntryAccess/);
assert.match(meetings, /projectDirectoryTable\.id, directoryEntryId/);
assert.match(meetings, /attendee_directory_entry_company_mismatch/);

assert.match(intake, /FROM project_directory WHERE project_id=\$1/);
assert.match(intake, /JOB_INTAKE_CLIENT_COMPANY_OUT_OF_SCOPE/);
assert.match(intake, /JOB_INTAKE_PRIMARY_CONTACT_OUT_OF_SCOPE/);
assert.match(intake, /JOB_INTAKE_PARTICIPANT_OUT_OF_SCOPE/);
assert.match(intake, /JOB_INTAKE_ENGAGEMENT_CONTACT_OUT_OF_SCOPE/);
assert.match(intake, /JOB_INTAKE_ASSIGNMENT_USER_INELIGIBLE/);

assert.match(members, /projectDirectoryTable\.projectId, projectId/);
assert.match(members, /projectMembersTable\.projectId, projectId/);

for (const [name, source] of [
  ["Meetings", meetings],
  ["Job Intake", intake],
  ["membership assignments", members],
  ["RFIs", rfis],
  ["Submittals", submittals],
]) {
  assert.doesNotMatch(
    source,
    /(?:update|delete)\(projectDirectoryTable\)/,
    `${name} must not mutate or delete authoritative Directory records`,
  );
}

assert.doesNotMatch(rfis, /projectDirectoryTable/);
assert.doesNotMatch(submittals, /projectDirectoryTable/);

console.log("POST-P18 Build 73 Project Directory consumer isolation: PASS");
