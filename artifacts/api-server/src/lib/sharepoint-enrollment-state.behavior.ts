import assert from "node:assert/strict"; import { sharePointEnrollmentState } from "./sharepoint-enrollment-state";
const base={projectId:28,companyAdmin:true,selectedSiteId:"site-1",microsoftConsent:"awaiting_microsoft_admin" as const,credentialState:"absent" as const,destinationBound:false};
const waiting=sharePointEnrollmentState(base); assert.equal(waiting.connected,false); assert.equal(waiting.next,"consent"); assert.equal(waiting.ordinaryUserHandlesMicrosoftConsent,false); assert.equal(waiting.resumable,true);
const connected=sharePointEnrollmentState({...base,microsoftConsent:"granted",credentialState:"active",destinationBound:true}); assert.equal(connected.state,"connected"); assert.equal(connected.next,"complete");
const denied=sharePointEnrollmentState({...base,microsoftConsent:"denied"}); assert.equal(denied.state,"consent_denied");
const ordinary=sharePointEnrollmentState({...base,companyAdmin:false}); assert.equal(ordinary.canConfigure,false); assert.equal(ordinary.ordinaryUserHandlesMicrosoftConsent,false);
console.log("C098 SharePoint resumable enrollment state: PASS");
