import assert from "node:assert/strict";
import {COMMERCIAL_OFFERS,commercialDestination,foundingDestination,journeyAction,offerPrice} from "./commercial-offers";
assert.deepEqual(COMMERCIAL_OFFERS.map(x=>x.id),["free","professional","team","business","enterprise"]);
assert.equal(offerPrice(COMMERCIAL_OFFERS[1],"annual"),"$1,490 / year");
assert.equal(offerPrice(COMMERCIAL_OFFERS[4],"monthly"),"Custom proposal");
assert.equal(commercialDestination(COMMERCIAL_OFFERS[0],"monthly"),"/register?plan=free&billing=monthly");
assert.equal(commercialDestination(COMMERCIAL_OFFERS[2],"annual","shop drawings"),"/contact?plan=team&billing=annual&useCase=shop+drawings");
assert.equal(foundingDestination("annual","shop drawings"),"/contact?plan=founding&billing=annual&useCase=shop+drawings");
for(const offer of COMMERCIAL_OFFERS){assert.ok(offer.audience&&offer.availability&&offer.included.length>=4);assert.equal(offer.journey,offer.id==="free"?"self_service":"sales_assisted");}
assert.match(journeyAction(COMMERCIAL_OFFERS[0]).detail,/no sales conversation/);assert.match(journeyAction(COMMERCIAL_OFFERS[1]).detail,/confirm entitlement/);
console.log("UX086 commercial offer truth: PASS");
