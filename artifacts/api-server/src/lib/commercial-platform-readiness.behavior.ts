import assert from "node:assert/strict";
import {inspectCommercialPlatformReadiness} from "./commercial-platform-readiness";

const empty=inspectCommercialPlatformReadiness({});
assert.equal(empty.subscriptionConfigured,false);
assert.equal(empty.checks.length,5);
assert.equal(empty.checks.every(item=>item.status==="not_configured"),true);

const valid=inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_standard_2026,price_enterprise_2026"});
assert.equal(valid.subscriptionConfigured,true);
assert.equal(valid.checks[0]?.code,"catalog_ready");
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_good_2026,invalid"}).subscriptionConfigured,false);
assert.equal(inspectCommercialPlatformReadiness({BIMLOG_STRIPE_PRICE_IDS:"price_duplicate_2026,price_duplicate_2026"}).subscriptionConfigured,false);
assert.equal(JSON.stringify(valid).includes("BIMLOG_STRIPE_PRICE_IDS"),false);
console.log("commercial platform readiness catalog behavior passed");
