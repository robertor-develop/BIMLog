import assert from "node:assert/strict"; import {reportExportPreview} from "./report-experience.ts";
const preview=reportExportPreview({label:"RFI Aging",from:"2026-01-01",to:"2026-01-31",status:"open",includeDetails:true,visibleRows:12});
assert.deepEqual(preview,{scope:"RFI Aging",dateRange:"2026-01-01 to 2026-01-31",status:"open",detail:"Supporting rows included",visibleRows:12});
console.log("PASS UX068 consistent export scope preview");
