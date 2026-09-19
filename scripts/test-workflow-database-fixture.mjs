import assert from "node:assert/strict";
import fs from "node:fs";
import { validateWorkflowFixture, workflowFixtureNames } from "./workflow-database-fixture.mjs";

const admin = "postgresql://fixture:fixture@127.0.0.1:55449/postgres";
assert.deepEqual(workflowFixtureNames, ["delivery_template_test", "delivery_runtime_test", "economic_allocation_test"]);
for (const name of workflowFixtureNames) assert.equal(new URL(validateWorkflowFixture(name, admin)).pathname, `/${name}`);
assert.throws(() => validateWorkflowFixture("production", admin), /not approved/);
assert.throws(() => validateWorkflowFixture("delivery_template_test", "postgresql://fixture:fixture@example.com:55449/postgres"), /loopback/);
const source = fs.readFileSync(new URL("./workflow-database-fixture.mjs", import.meta.url), "utf8");
assert.match(source, /finally\s*\{[\s\S]*mode === '--run'[\s\S]*await drop\(\)/);
assert.match(source, /CREATE DATABASE/);
assert.match(source, /DROP DATABASE IF EXISTS/);
console.log("WORKFLOW_DATABASE_FIXTURE=PASS names=3 create_run_remove=bounded loopback=55449");
