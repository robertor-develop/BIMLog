import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinancialApprovalPolicyRecords} from './FinancialApprovalPolicyRecords';
const policy={id:'policy-1',transaction_category:'commitment_approval',currency:'USD',max_amount:'999999999999999999999999.123456',version:2,state:'active',scope_type:'project',project_id:91,effective_from:'2026-10-29T12:00:00Z',effective_to:null,reason:'<script>must remain text</script>',created_by_id:71};
const html=renderToStaticMarkup(<FinancialApprovalPolicyRecords policies={[policy]} es={false}/>);assert.match(html,/999999999999999999999999\.123456 USD/);assert.match(html,/v2/);assert.match(html,/Project 91/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/does not approve any transaction/);
assert.match(renderToStaticMarkup(<FinancialApprovalPolicyRecords policies={[]} es={true}/>),/Sin políticas de aprobación/);
console.log('Approval policy records: exact decimal/currency, saved revision/scope, reason escaping and Spanish empty state PASS');
