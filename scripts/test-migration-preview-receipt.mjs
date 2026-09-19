import assert from "node:assert/strict";
import { sourceSchemaReceipt } from "./database-schema-receipt.mjs";
import { createMigrationPreviewReceipt } from "./migration-preview-receipt.mjs";

const source = sourceSchemaReceipt();
const exact = createMigrationPreviewReceipt(source, {
  tables: [...source.contract.tables],
  indexes: [...source.contract.indexes],
});
assert.equal(exact.status, "ZERO_PENDING");
assert.equal(exact.rollbackRequirement, "NO_SCHEMA_CHANGE");
assert.match(exact.receiptSha256, /^[a-f0-9]{64}$/);

const changed = createMigrationPreviewReceipt(source, {
  tables: source.contract.tables.slice(1),
  indexes: source.contract.indexes.slice(1),
});
assert.equal(changed.status, "PROVIDER_PREVIEW_REQUIRED");
assert.equal(changed.pending.tables.length, 1);
assert.equal(changed.pending.indexes.length, 1);
assert.equal(changed.rollbackRequirement, "VERIFIED_BACKUP_AND_COMPLETE_ADDITIVE_INVENTORY_REQUIRED");

console.log("MIGRATION_PREVIEW_RECEIPT_TESTS=PASS zero_pending=1 changed=1 fail_closed=1");
