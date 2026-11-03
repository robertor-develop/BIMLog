import assert from 'node:assert/strict';
import { customerFeedbackDeliveryReceipt } from './feedback-customer-delivery';
const row={state:'delivered',receipt_id:`bimlog-feedback-${'a'.repeat(64)}`,receipt_revision:3,settled_at:'2026-10-29T12:00:00Z',lease_token:'private-lease',lease_owner:'internal-worker',case_digest:'private-digest'};
assert.deepEqual(customerFeedbackDeliveryReceipt(row),{receiptId:row.receipt_id,caseRevision:3,settledAt:'2026-10-29T12:00:00.000Z'});
for(const state of ['pending','claimed','retry-required','dead-letter'])assert.equal(customerFeedbackDeliveryReceipt({...row,state}),null);
for(const patch of [{receipt_id:'bad'},{receipt_revision:0},{receipt_revision:NaN},{settled_at:null},{settled_at:'invalid'}])assert.equal(customerFeedbackDeliveryReceipt({...row,...patch}),null);
assert.doesNotMatch(JSON.stringify(customerFeedbackDeliveryReceipt(row)),/lease|worker|digest|private/);
console.log('Customer delivery receipt: completed-only exact receipt/revision/time, malformed refusal, secret exclusion PASS');
