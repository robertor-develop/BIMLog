import assert from "node:assert/strict";
import { sourceSchemaReceipt } from "./database-schema-receipt.mjs";
import { evaluatePublicationDatabases } from "./publication-database-operator.mjs";

const source = sourceSchemaReceipt();
const exact = { tables: [...source.contract.tables], indexes: [...source.contract.indexes], columns: [...source.contract.columns], checks: [...source.contract.checks], constraintIndexes: [] };
const pass = evaluatePublicationDatabases(source, exact, exact);
assert.equal(pass.publishable, true);
assert.equal(pass.schemaAction, "NONE");

const changed = { tables: source.contract.tables.slice(1), indexes: [...source.contract.indexes], columns: [...source.contract.columns], checks: [...source.contract.checks], constraintIndexes: [] };
const fail = evaluatePublicationDatabases(source, exact, changed);
assert.equal(fail.publishable, false);
assert.equal(fail.schemaAction, "STOP_COMPLETE_PREVIEW_AND_RESTORE_PROOF_REQUIRED");
const columnDrift = { ...exact, columns: exact.columns.filter((name) => name !== "job_activation_tasks.start_date") };
assert.equal(evaluatePublicationDatabases(source, exact, columnDrift).publishable, false);
const checkDrift = { ...exact, checks: exact.checks.filter((name) => name !== "job_activation_tasks.job_activation_task_dates_chk") };
assert.equal(evaluatePublicationDatabases(source, exact, checkDrift).publishable, false);
console.log("PUBLICATION_DATABASE_OPERATOR_TESTS=PASS exact=1 table_mismatch_stop=1 column_mismatch_stop=1 check_mismatch_stop=1 data_copy_off=1");
