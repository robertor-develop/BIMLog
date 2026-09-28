import assert from "node:assert/strict";
import { normalizeReportViewConfiguration, upgradeLegacyCoordinatorView } from "./report-view-capabilities";

const legacy = { builtInView: "all_actionable", modules: ["rfi"] };
assert.deepEqual(upgradeLegacyCoordinatorView(legacy).filters, legacy);
assert.equal(normalizeReportViewConfiguration({ schemaVersion: 2, dataset: "rfi", columns: ["number", "status"], sort: "number_asc", groupBy: "status", filters: { status: ["open", "open"] } }).filters.status.length, 1);
assert.throws(() => normalizeReportViewConfiguration({ schemaVersion: 2, dataset: "rfi", columns: ["password"], sort: "number_asc", filters: {} }), /COLUMN_UNSUPPORTED/);
assert.throws(() => normalizeReportViewConfiguration({ schemaVersion: 2, dataset: "submittal", columns: ["number"], sort: "secret_sort", filters: {} }), /SORT_UNSUPPORTED/);
console.log("C036 typed report-view capabilities: PASS");
