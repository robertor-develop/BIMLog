import assert from "node:assert/strict";
import { createCompanySubscription } from "./subscription-authority";
import { deriveSubscriptionAccess } from "./commercial-billing-operations";
import { assessCustomerSupportReadiness, deriveCustomerSupportEntitlement, openCustomerSupportCase, projectCustomerSupportWorkspace, transitionCustomerSupportCase } from "./commercial-customer-support";

const subscriptionBase = createCompanySubscription({ id:"sub-46", companyId:7, planId:"business", catalogPriceVersion:7, billingCycle:"monthly", currency:"USD", amount:3000, now:"2026-10-01T00:00:00Z" });
const subscription = { ...subscriptionBase, status:"active" as const, revision:2, updatedAt:"2026-10-01T00:01:00.000Z" };
const term = { subscriptionId:subscription.id, sequence:1, billingCycle:"monthly" as const, startsAt:"2026-10-01T00:00:00.000Z", endsAt:"2026-11-01T00:00:00.000Z", renewsAt:"2026-11-01T00:00:00.000Z", sourceOrderId:"order-46", sourceInvoiceId:"invoice-46" };
const grant = deriveSubscriptionAccess({ subscription, term, catalogPriceVersionId:"price-v7", features:["projects","coordination"], seatLimit:12, existing:[], now:"2026-10-02T00:00:00Z" });
const entitlement = deriveCustomerSupportEntitlement({ subscription, grant, tier:"priority", channels:["web","email","web"], existing:[], now:"2026-10-02T00:00:00Z" });
assert.deepEqual({ company:entitlement.companyId, tier:entitlement.tier, channels:entitlement.channels, target:entitlement.responseTargetMinutes }, { company:7, tier:"priority", channels:["web","email"], target:240 });
assert.equal(deriveCustomerSupportEntitlement({ subscription, grant, tier:"priority", channels:["web"], existing:[entitlement], now:"2026-10-02T00:01:00Z" }), entitlement);
assert.throws(() => deriveCustomerSupportEntitlement({ subscription:{ ...subscription, status:"past_due" }, grant, tier:"standard", channels:["web"], existing:[], now:"2026-10-02T00:00:00Z" }), /active subscription/);
console.log("B046 subscription-bound customer support entitlement: PASS");

const supportCase = openCustomerSupportCase({ entitlement, requesterUserId:71, channel:"web", locale:"es", category:"billing", priority:"urgent", subject:"Invoice amount differs", description:"The October invoice does not match our approved subscription.", requestKey:"customer-71-october-invoice", existing:[], now:"2026-10-03T10:00:00Z" });
assert.deepEqual({ company:supportCase.companyId, status:supportCase.status, due:supportCase.responseDueAt, revision:supportCase.revision }, { company:7, status:"open", due:"2026-10-03T12:00:00.000Z", revision:1 });
assert.equal(openCustomerSupportCase({ entitlement, requesterUserId:71, channel:"web", locale:"es", category:"billing", priority:"urgent", subject:"Invoice amount differs", description:"The October invoice does not match our approved subscription.", requestKey:"customer-71-october-invoice", existing:[supportCase], now:"2026-10-03T10:01:00Z" }), supportCase);
assert.throws(() => openCustomerSupportCase({ entitlement, requesterUserId:71, channel:"phone" as never, locale:"en", category:"technical", priority:"normal", subject:"Phone request", description:"This channel is not included.", requestKey:"bad-channel", existing:[], now:"2026-10-03T10:00:00Z" }), /channel is not entitled/);
console.log("B047 idempotent support case intake and SLA: PASS");

const acknowledged = transitionCustomerSupportCase({ supportCase, expectedRevision:1, actorUserId:901, actorRole:"support", action:"acknowledge", note:"Billing specialist assigned.", now:"2026-10-03T10:30:00Z" });
assert.deepEqual({ status:acknowledged.supportCase.status, revision:acknowledged.supportCase.revision, action:acknowledged.event.action, from:acknowledged.event.fromStatus }, { status:"in_progress", revision:2, action:"acknowledge", from:"open" });
const resolved = transitionCustomerSupportCase({ supportCase:acknowledged.supportCase, expectedRevision:2, actorUserId:901, actorRole:"support", action:"resolve", note:"Confirmed the credit note and corrected statement.", now:"2026-10-03T11:00:00Z" });
assert.equal(resolved.supportCase.status, "resolved");
assert.throws(() => transitionCustomerSupportCase({ supportCase, expectedRevision:1, actorUserId:71, actorRole:"customer", action:"acknowledge", note:"Self assign", now:"2026-10-03T10:30:00Z" }), /cannot perform/);
assert.throws(() => transitionCustomerSupportCase({ supportCase:acknowledged.supportCase, expectedRevision:1, actorUserId:901, actorRole:"support", action:"resolve", note:"stale", now:"2026-10-03T11:00:00Z" }), /revision conflict/);
console.log("B048 revision-safe support lifecycle and audit: PASS");

const otherCase = openCustomerSupportCase({ entitlement, requesterUserId:72, channel:"email", locale:"en", category:"technical", priority:"normal", subject:"Export is unavailable", description:"The governed project export remains unavailable after retry.", requestKey:"customer-72-export", existing:[supportCase], now:"2026-10-03T12:00:00Z" });
const customerView = projectCustomerSupportWorkspace({ companyId:7, viewerUserId:71, role:"customer", entitlement, cases:[resolved.supportCase,otherCase], events:[acknowledged.event,resolved.event] });
assert.deepEqual({ cases:customerView.cases.length, requester:customerView.cases[0]?.requesterUserId, canManage:customerView.canManage, events:customerView.events.length }, { cases:1, requester:null, canManage:false, events:2 });
const supportView = projectCustomerSupportWorkspace({ companyId:7, viewerUserId:901, role:"support", entitlement, cases:[resolved.supportCase,otherCase], events:[acknowledged.event,resolved.event] });
assert.deepEqual({ cases:supportView.cases.length, requester:supportView.cases[0]?.requesterUserId, canManage:supportView.canManage }, { cases:2, requester:71, canManage:true });
const auditView = projectCustomerSupportWorkspace({ companyId:7, viewerUserId:990, role:"auditor", entitlement, cases:[resolved.supportCase], events:[resolved.event] });
assert.equal(auditView.cases[0]?.description, null);
assert.equal(auditView.events[0]?.note, null);
console.log("B049 permission-safe customer support projection: PASS");

const ready = assessCustomerSupportReadiness({ companyId:7, entitlement, cases:[resolved.supportCase,otherCase], events:[acknowledged.event,resolved.event], now:"2026-10-03T11:30:00Z" });
assert.deepEqual(ready, { status:"ready", blockers:[], checkedAt:"2026-10-03T11:30:00.000Z" });
const actionRequired = assessCustomerSupportReadiness({ companyId:7, entitlement, cases:[supportCase], events:[], now:"2026-10-03T13:00:00Z" });
assert.deepEqual(actionRequired.blockers, ["OPEN_CASE_OVERDUE","UNRESOLVED_URGENT_CASE"]);
assert.equal(assessCustomerSupportReadiness({ companyId:7, entitlement:null, cases:[], events:[], now:"2026-10-03T11:30:00Z" }).blockers[0], "ENTITLEMENT_MISSING");
assert.equal(assessCustomerSupportReadiness({ companyId:7, entitlement, cases:[resolved.supportCase], events:[acknowledged.event], now:"2026-10-03T11:30:00Z" }).blockers.includes("CASE_EVENT_GAP"), true);
console.log("B050 fail-closed customer support readiness: PASS");
