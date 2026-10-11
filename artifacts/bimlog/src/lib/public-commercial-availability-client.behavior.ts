import assert from "node:assert/strict";import {parsePublicCommercialAvailability} from "./public-commercial-availability-client";
const consultation=parsePublicCommercialAvailability({schemaVersion:"bimlog-public-commercial-availability-v2",freeSignupAvailable:true,emailVerification:"required_before_project_setup",freeOffer:{projectLimit:1,memberLimit:5,evaluationPeriodDays:null},paidPlans:"consultation_only",nextAction:"request_plan_consultation"});assert.equal(consultation.paidPlans,"consultation_only");
assert.equal(consultation.freeOffer.evaluationPeriodDays,null);
assert.throws(()=>parsePublicCommercialAvailability({...consultation,secret:"hidden"}));assert.throws(()=>parsePublicCommercialAvailability({...consultation,nextAction:"create_free_account"}));
console.log("LR013 strict public commercial availability browser contract: PASS");
