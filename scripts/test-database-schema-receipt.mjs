import assert from "node:assert/strict";
import { classifySchemaInventory, sourceSchemaReceipt } from "./database-schema-receipt.mjs";

const receipt = sourceSchemaReceipt();
assert.deepEqual(receipt.counts, { tables: 223, indexes: 273, startupTables: 184 });
assert.match(receipt.sourceContractSha256, /^[a-f0-9]{64}$/);

const exact = classifySchemaInventory(receipt, {
  tables: [...receipt.contract.tables],
  indexes: [...receipt.contract.indexes],
});
assert.equal(exact.exact, true);

const different = classifySchemaInventory(receipt, {
  tables: [...receipt.contract.tables.slice(1), "unexpected_table"],
  indexes: [...receipt.contract.indexes.slice(1), "unexpected_index"],
  constraintIndexes: [],
});
assert.equal(different.exact, false);
assert.deepEqual(different.tables.missing, [receipt.contract.tables[0]]);
assert.deepEqual(different.tables.extra, ["unexpected_table"]);
assert.deepEqual(different.indexes.missing, [receipt.contract.indexes[0]]);
assert.deepEqual(different.indexes.extra, ["unexpected_index"]);

const constraintBacked = classifySchemaInventory(receipt, {
  tables: [...receipt.contract.tables],
  indexes: [...receipt.contract.indexes, "example_pkey"],
  constraintIndexes: ["example_pkey"],
});
assert.equal(constraintBacked.exact, true);
assert.deepEqual(constraintBacked.indexes.constraintBackedExtra, ["example_pkey"]);

console.log("DATABASE_SCHEMA_RECEIPT_TESTS=PASS exact=1 classified_difference=1 counts=223/273/184");
