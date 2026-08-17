import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paymentHistoryDto } from "./ContractPaymentHistoryPanel";

const camel=paymentHistoryDto({actorUserId:102,paymentApplicationId:"root-1",paymentVersionId:"version-2",eventType:"payment_application_revised",beforeState:"returned",afterState:"draft",reasonCode:"PAYMENT_REVISED",evidence:{supersededPaymentVersionId:"version-1",outcomeReason:"Corrected evidence"},occurredAt:"2026-08-16T12:00:00Z"});
assert.equal(camel.actorUserId,102);
assert.equal(camel.paymentApplicationId,"root-1");
assert.equal(camel.paymentVersionId,"version-2");
assert.deepEqual(camel.evidence,{supersededPaymentVersionId:"version-1",outcomeReason:"Corrected evidence"});
const snake=paymentHistoryDto({actor_user_id:103,payment_application_id:"root-2",payment_version_id:"version-3",event_type:"payment_application_return",before_state:"submitted",after_state:"returned",reason_code:"PAYMENT_RETURNED",evidence:{outcomeReason:"More support required"},occurred_at:"2026-08-16T13:00:00Z"});
assert.equal(snake.actorUserId,103);
assert.equal(snake.beforeState,"submitted");
assert.equal(snake.afterState,"returned");
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"ContractPaymentHistoryPanel.tsx"),"utf8");
for(const proof of ["Attributable payment history","Historial de pagos atribuible","Application root ID","ID raíz de solicitud","Revision linkage","Vínculo de revisión","Decision reason","Motivo de decisión","Payment history access denied","Autoridad de historial de pagos suspendida","supersededPaymentVersionId","outcomeReason"]){assert.match(source,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))}
assert.match(source,/eventLabels\[event\.eventType\].*Payment lifecycle event/);
console.log(JSON.stringify({suite:"attributable-payment-history-ui",status:"passed",checks:16},null,2));
