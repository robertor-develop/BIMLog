import assert from "node:assert/strict";
import { COMMERCIAL_OFFERS } from "./commercial-offers";
import { commercialAvailabilityJourney } from "./commercial-availability-journey";

const offer = (id: string) => COMMERCIAL_OFFERS.find((entry) => entry.id === id)!;
const ready = { schemaVersion: "bimlog-public-commercial-availability-v1", freeSignupAvailable: true, paidPlans: "available", nextAction: "create_free_account" } as const;
const consultation = { schemaVersion: "bimlog-public-commercial-availability-v1", freeSignupAvailable: true, paidPlans: "consultation_only", nextAction: "request_plan_consultation" } as const;

assert.deepEqual(commercialAvailabilityJourney(offer("free"), "monthly", "shop drawings", ready).mode, "free_signup");
const paid = commercialAvailabilityJourney(offer("professional"), "annual", "shop drawings", ready);
assert.equal(paid.mode, "paid_signup");
assert.equal(paid.destination, "/register?plan=professional&billing=annual&useCase=shop+drawings");
assert.match(paid.detail.en, /does not take payment/i);
const assisted = commercialAvailabilityJourney(offer("team"), "monthly", "", consultation);
assert.equal(assisted.mode, "consultation");
assert.equal(assisted.destination, "/contact?plan=team&billing=monthly");
assert.equal(commercialAvailabilityJourney(offer("business"), "monthly", "", null).mode, "consultation");
assert.equal(commercialAvailabilityJourney(offer("enterprise"), "annual", "", ready).mode, "custom_consultation");
console.log("LR016-LR019 availability-aware commercial journey: PASS");
